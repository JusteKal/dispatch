// pages/index.js
import { useState, useEffect, useReducer } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import styles from '../styles/Home.module.css';

// Types d'actions pour le reducer
const ACTIONS = {
  LOAD_DATA: 'LOAD_DATA',
  ADD_DOCTOR: 'ADD_DOCTOR',
  UPDATE_DOCTOR: 'UPDATE_DOCTOR',
  DELETE_DOCTOR: 'DELETE_DOCTOR',
  ADD_LOCATION: 'ADD_LOCATION',
  UPDATE_LOCATION: 'UPDATE_LOCATION',
  DELETE_LOCATION: 'DELETE_LOCATION',
  MOVE_DOCTOR: 'MOVE_DOCTOR',
  REMOVE_DOCTOR_FROM_LOCATION: 'REMOVE_DOCTOR_FROM_LOCATION'
};

// Reducer pour gérer l'état de l'application
function appReducer(state, action) {
  switch (action.type) {
    case ACTIONS.LOAD_DATA:
      return { ...action.payload };
    
    case ACTIONS.ADD_DOCTOR:
      const newDoctor = {
        id: Date.now(),
        name: action.payload.name,
        specialty: action.payload.specialty
      };
      return {
        ...state,
        doctors: [...state.doctors, newDoctor]
      };
    
    case ACTIONS.UPDATE_DOCTOR:
      return {
        ...state,
        doctors: state.doctors.map(doctor => 
          doctor.id === action.payload.id ? { ...doctor, ...action.payload } : doctor
        )
      };
    
    case ACTIONS.DELETE_DOCTOR:
      // Retirer le médecin de toutes les affectations avant de le supprimer
      const newAssignmentsAfterDelete = { ...state.assignments };
      Object.keys(newAssignmentsAfterDelete).forEach(locationId => {
        newAssignmentsAfterDelete[locationId] = newAssignmentsAfterDelete[locationId].filter(
          doctorId => doctorId !== action.payload
        );
      });
      
      return {
        ...state,
        doctors: state.doctors.filter(doctor => doctor.id !== action.payload),
        assignments: newAssignmentsAfterDelete
      };
    
    case ACTIONS.ADD_LOCATION:
      const newLocation = {
        id: Date.now(),
        name: action.payload.name,
        type: action.payload.type
      };
      return {
        ...state,
        locations: [...state.locations, newLocation],
        assignments: { ...state.assignments, [newLocation.id]: [] }
      };
    
    case ACTIONS.UPDATE_LOCATION:
      return {
        ...state,
        locations: state.locations.map(location => 
          location.id === action.payload.id ? { ...location, ...action.payload } : location
        )
      };
    
    case ACTIONS.DELETE_LOCATION:
      const { [action.payload]: removed, ...remainingAssignments } = state.assignments;
      return {
        ...state,
        locations: state.locations.filter(location => location.id !== action.payload),
        assignments: remainingAssignments
      };
    
    case ACTIONS.MOVE_DOCTOR:
      const { doctorId, source, destination } = action.payload;
      
      // Créer une copie des affectations
      const updatedAssignments = { ...state.assignments };
      
      // Retirer le médecin de tous les lieux d'abord (pour éviter les doublons)
      Object.keys(updatedAssignments).forEach(locationId => {
        updatedAssignments[locationId] = updatedAssignments[locationId].filter(id => id !== doctorId);
      });
      
      // Ajouter le médecin à la destination si elle existe
      if (destination && updatedAssignments[destination]) {
        updatedAssignments[destination] = [...updatedAssignments[destination], doctorId];
      }
      
      return {
        ...state,
        assignments: updatedAssignments
      };
    
    case ACTIONS.REMOVE_DOCTOR_FROM_LOCATION:
      const { doctorId: docId, locationId } = action.payload;
      const updatedAssignmentsAfterRemove = { ...state.assignments };
      
      if (updatedAssignmentsAfterRemove[locationId]) {
        updatedAssignmentsAfterRemove[locationId] = updatedAssignmentsAfterRemove[locationId].filter(
          id => id !== docId
        );
      }
      
      return {
        ...state,
        assignments: updatedAssignmentsAfterRemove
      };
    
    default:
      return state;
  }
}

// Composant pour un médecin draggable
const DoctorCard = ({ doctor, onEdit, onDelete, onRemoveFromLocation, currentLocation }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'doctor',
    item: { id: doctor.id, currentLocation },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  }));

  return (
    <div 
      ref={drag} 
      className={`${styles.doctorCard} ${isDragging ? styles.dragging : ''}`}
    >
      <div className={styles.doctorInfo}>
        <h4>{doctor.name}</h4>
        <p>{doctor.specialty}</p>
      </div>
      <div className={styles.doctorActions}>
        <button onClick={() => onEdit(doctor)}>✏️</button>
        <button onClick={() => onDelete(doctor.id)}>🗑️</button>
        {currentLocation && (
          <button 
            onClick={() => onRemoveFromLocation(doctor.id, currentLocation)}
            title="Retirer de ce lieu"
          >
            ➖
          </button>
        )}
      </div>
    </div>
  );
};

// Composant pour une zone de drop (repos, intervention, absent)
const LocationDropZone = ({ location, doctors, assignments, onDoctorDropped, onRemoveDoctor }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'doctor',
    drop: (item) => onDoctorDropped(item.id, location.id, item.currentLocation),
    collect: (monitor) => ({
      isOver: !!monitor.isOver()
    })
  }));

  const assignedDoctors = assignments[location.id] 
    ? assignments[location.id].map(doctorId => 
        doctors.find(doctor => doctor.id === doctorId)
      ).filter(Boolean)
    : [];

  return (
    <div 
      ref={drop} 
      className={`${styles.location} ${isOver ? styles.highlighted : ''}`}
    >
      <h3>{location.name}</h3>
      <div className={styles.assignedDoctors}>
        {assignedDoctors.length === 0 ? (
          <p className={styles.emptyMessage}>Aucun médecin assigné</p>
        ) : (
          assignedDoctors.map(doctor => (
            <DoctorCard 
              key={doctor.id} 
              doctor={doctor} 
              onEdit={() => {}} 
              onDelete={() => {}}
              onRemoveFromLocation={onRemoveDoctor}
              currentLocation={location.id}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Composant principal
export default function Home() {
  const [state, dispatch] = useReducer(appReducer, {
    doctors: [],
    locations: [],
    assignments: {}
  });

  const [editingDoctor, setEditingDoctor] = useState(null);
  const [newDoctor, setNewDoctor] = useState({ name: '', specialty: '' });
  const [editingLocation, setEditingLocation] = useState(null);
  const [newLocation, setNewLocation] = useState({ name: '', type: '' });

  // Charger les données au montage du composant
  useEffect(() => {
    const savedData = localStorage.getItem('doctorDispatchData');
    if (savedData) {
      dispatch({ type: ACTIONS.LOAD_DATA, payload: JSON.parse(savedData) });
    } else {
      // Données par défaut
      const defaultData = {
        doctors: [
          { id: 1, name: "Dr. Dupont", specialty: "Cardiologie" },
          { id: 2, name: "Dr. Martin", specialty: "Pédiatrie" },
          { id: 3, name: "Dr. Leroy", specialty: "Chirurgie" }
        ],
        locations: [
          { id: 'repos', name: "Repos", type: "repos" },
          { id: 'intervention', name: "Intervention", type: "intervention" },
          { id: 'absent', name: "Absent", type: "absent" }
        ],
        assignments: {
          repos: [1],
          intervention: [2],
          absent: [3]
        }
      };
      dispatch({ type: ACTIONS.LOAD_DATA, payload: defaultData });
    }
  }, []);

  // Sauvegarder les données à chaque changement
  useEffect(() => {
    localStorage.setItem('doctorDispatchData', JSON.stringify(state));
  }, [state]);

  const handleDoctorDropped = (doctorId, locationId, sourceLocation) => {
    // Si on dépose sur le même lieu, on ne fait rien
    if (sourceLocation === locationId) return;
    
    dispatch({
      type: ACTIONS.MOVE_DOCTOR,
      payload: { doctorId, source: sourceLocation, destination: locationId }
    });
  };

  const handleRemoveDoctorFromLocation = (doctorId, locationId) => {
    dispatch({
      type: ACTIONS.REMOVE_DOCTOR_FROM_LOCATION,
      payload: { doctorId, locationId }
    });
  };

  const handleAddDoctor = () => {
    if (newDoctor.name && newDoctor.specialty) {
      dispatch({ type: ACTIONS.ADD_DOCTOR, payload: newDoctor });
      setNewDoctor({ name: '', specialty: '' });
    }
  };

  const handleUpdateDoctor = () => {
    if (editingDoctor && editingDoctor.name && editingDoctor.specialty) {
      dispatch({ type: ACTIONS.UPDATE_DOCTOR, payload: editingDoctor });
      setEditingDoctor(null);
    }
  };

  const handleDeleteDoctor = (id) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce médecin ?")) {
      dispatch({ type: ACTIONS.DELETE_DOCTOR, payload: id });
    }
  };

  const handleAddLocation = () => {
    if (newLocation.name && newLocation.type) {
      dispatch({ type: ACTIONS.ADD_LOCATION, payload: newLocation });
      setNewLocation({ name: '', type: '' });
    }
  };

  const handleUpdateLocation = () => {
    if (editingLocation && editingLocation.name && editingLocation.type) {
      dispatch({ type: ACTIONS.UPDATE_LOCATION, payload: editingLocation });
      setEditingLocation(null);
    }
  };

  const handleDeleteLocation = (id) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce lieu ?")) {
      dispatch({ type: ACTIONS.DELETE_LOCATION, payload: id });
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={styles.container}>
        <h1 className="h1">Gestion des Médecins</h1>

        <div className={styles.managementSection}>
          <div className={styles.section}>
            <h2>Gestion des Médecins</h2>
            <div className={styles.form}>
              <input
                type="text"
                placeholder="Nom du médecin"
                value={newDoctor.name}
                onChange={(e) => setNewDoctor({...newDoctor, name: e.target.value})}
              />
              <input
                type="text"
                placeholder="Spécialité"
                value={newDoctor.specialty}
                onChange={(e) => setNewDoctor({...newDoctor, specialty: e.target.value})}
              />
              <button onClick={handleAddDoctor}>Ajouter</button>
            </div>
            
            {editingDoctor && (
              <div className={styles.form}>
                <h3>Modifier le médecin</h3>
                <input
                  type="text"
                  placeholder="Nom du médecin"
                  value={editingDoctor.name}
                  onChange={(e) => setEditingDoctor({...editingDoctor, name: e.target.value})}
                />
                <input
                  type="text"
                  placeholder="Spécialité"
                  value={editingDoctor.specialty}
                  onChange={(e) => setEditingDoctor({...editingDoctor, specialty: e.target.value})}
                />
                <button onClick={handleUpdateDoctor}>Enregistrer</button>
                <button onClick={() => setEditingDoctor(null)}>Annuler</button>
              </div>
            )}
            
            <div className={styles.doctorsList}>
              <h3>Médecins disponibles</h3>
              {state.doctors
                .filter(doctor => 
                  !Object.values(state.assignments).flat().includes(doctor.id)
                )
                .map(doctor => (
                  <DoctorCard 
                    key={doctor.id} 
                    doctor={doctor} 
                    onEdit={setEditingDoctor}
                    onDelete={handleDeleteDoctor}
                    onRemoveFromLocation={() => {}}
                  />
                ))}
            </div>
          </div>
          
          <div className={styles.section}>
            <h2>Gestion des Lieux</h2>
            <div className={styles.form}>
              <input
                type="text"
                placeholder="Nom du lieu"
                value={newLocation.name}
                onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
              />
              <select
                value={newLocation.type}
                onChange={(e) => setNewLocation({...newLocation, type: e.target.value})}
              >
                <option value="">Sélectionner un type</option>
                <option value="repos">Repos</option>
                <option value="intervention">Intervention</option>
                <option value="absent">Absent</option>
                <option value="other">Autre</option>
              </select>
              <button onClick={handleAddLocation}>Ajouter</button>
            </div>
            
            {editingLocation && (
              <div className={styles.form}>
                <h3>Modifier le lieu</h3>
                <input
                  type="text"
                  placeholder="Nom du lieu"
                  value={editingLocation.name}
                  onChange={(e) => setEditingLocation({...editingLocation, name: e.target.value})}
                />
                <select
                  value={editingLocation.type}
                  onChange={(e) => setEditingLocation({...editingLocation, type: e.target.value})}
                >
                  <option value="repos">Repos</option>
                  <option value="intervention">Intervention</option>
                  <option value="absent">Absent</option>
                  <option value="other">Autre</option>
                </select>
                <button onClick={handleUpdateLocation}>Enregistrer</button>
                <button onClick={() => setEditingLocation(null)}>Annuler</button>
              </div>
            )}
            
            <div className={styles.locationsList}>
              {state.locations.map(location => (
                <div key={location.id} className={styles.locationItem}>
                  <span>{location.name} ({location.type})</span>
                  <div>
                    <button onClick={() => setEditingLocation(location)}>✏️</button>
                    <button onClick={() => handleDeleteLocation(location.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className={styles.dispatchSection}>
          <h2>Affectation des Médecins</h2>
          <div className={styles.locationsGrid}>
            {state.locations.map(location => (
              <LocationDropZone
                key={location.id}
                location={location}
                doctors={state.doctors}
                assignments={state.assignments}
                onDoctorDropped={handleDoctorDropped}
                onRemoveDoctor={handleRemoveDoctorFromLocation}
              />
            ))}
          </div>
        </div>
        
      </div>
    </DndProvider>
  );
}