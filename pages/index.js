// pages/index.js
import { useState, useEffect, useReducer, useRef } from 'react';
import { io } from 'socket.io-client';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Head from 'next/head';
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

  const handleEdit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(doctor);
  };

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(doctor.id);
  };

  const handleRemove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onRemoveFromLocation(doctor.id, currentLocation);
  };

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
        {!currentLocation ? (
          <>
            <button onClick={handleEdit} type="button">✏️</button>
            <button onClick={handleDelete} type="button">🗑️</button>
          </>
        ) : (
          <button 
            onClick={handleRemove}
            title="Retirer de ce lieu"
            type="button"
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
  // Référence pour le socket
  const socketRef = useRef(null);

  const [editingDoctor, setEditingDoctor] = useState(null);
  const [newDoctor, setNewDoctor] = useState({ name: '', specialty: '' });
  const [editingLocation, setEditingLocation] = useState(null);
  const [newLocation, setNewLocation] = useState({ name: '', type: '' });
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteLocationConfirmation, setDeleteLocationConfirmation] = useState(null);
  const [showEditLocationModal, setShowEditLocationModal] = useState(false);


  // Initialisation socket.io et chargement des données
  useEffect(() => {
    // Connexion au serveur socket.io
    socketRef.current = io('http://localhost:4000');

    // Réception de l'état partagé du serveur
    socketRef.current.on('sync', (data) => {
      dispatch({ type: ACTIONS.LOAD_DATA, payload: data });
    });

    // Pas d'envoi d'état local à la connexion : on attend l'état du serveur

    return () => {
      socketRef.current.disconnect();
    };
  }, []);


  // Sauvegarder localement à chaque changement (mais ne pas envoyer tout l'état au serveur)
  useEffect(() => {
    localStorage.setItem('doctorDispatchData', JSON.stringify(state));
  }, [state]);

  // Fonction pour dispatcher une action locale ET la synchroniser au serveur
  const syncDispatch = (action) => {
    dispatch(action);
    if (socketRef.current) {
      socketRef.current.emit('action', action);
    }
  };


  const handleDoctorDropped = (doctorId, locationId, sourceLocation) => {
    if (sourceLocation === locationId) return;
    syncDispatch({
      type: ACTIONS.MOVE_DOCTOR,
      payload: { doctorId, source: sourceLocation, destination: locationId }
    });
  };

  const handleRemoveDoctorFromLocation = (doctorId, locationId) => {
    syncDispatch({
      type: ACTIONS.REMOVE_DOCTOR_FROM_LOCATION,
      payload: { doctorId, locationId }
    });
  };

  const handleAddDoctor = () => {
    if (newDoctor.name && newDoctor.specialty) {
      syncDispatch({ type: ACTIONS.ADD_DOCTOR, payload: newDoctor });
      setNewDoctor({ name: '', specialty: '' });
    }
  };

  const handleUpdateDoctor = () => {
    if (editingDoctor && editingDoctor.name && editingDoctor.specialty) {
      syncDispatch({ type: ACTIONS.UPDATE_DOCTOR, payload: editingDoctor });
      setEditingDoctor(null);
      setShowEditModal(false);
    }
  };

  const handleDeleteDoctor = (id) => {
    setDeleteConfirmation(id);
  };

  const confirmDeleteDoctor = () => {
    if (deleteConfirmation) {
      syncDispatch({ type: ACTIONS.DELETE_DOCTOR, payload: deleteConfirmation });
      setDeleteConfirmation(null);
    }
  };

  const handleAddLocation = () => {
    if (newLocation.name && newLocation.type) {
      syncDispatch({ type: ACTIONS.ADD_LOCATION, payload: newLocation });
      setNewLocation({ name: '', type: '' });
    }
  };

  const handleUpdateLocation = () => {
    if (editingLocation && editingLocation.name && editingLocation.type) {
      syncDispatch({ type: ACTIONS.UPDATE_LOCATION, payload: editingLocation });
      setEditingLocation(null);
    }
  };

  const handleDeleteLocation = (id) => {
    setDeleteLocationConfirmation(id);
  };

  const confirmDeleteLocation = () => {
    if (deleteLocationConfirmation) {
      syncDispatch({ type: ACTIONS.DELETE_LOCATION, payload: deleteLocationConfirmation });
      setDeleteLocationConfirmation(null);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <Head>
        <title>Dispatch LSMS</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="description" content="Système de gestion des médecins" />
      </Head>
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
              <select
                value={newDoctor.specialty}
                onChange={(e) => setNewDoctor({...newDoctor, specialty: e.target.value})}
              >
                <option value="">Sélectionner un grade</option>
                <option value="Stagiaire">Stagiaire</option>
                <option value="Interne">Interne</option>
                <option value="Médecin">Médecin</option>
                <option value="Médecin-chef">Médecin Chef</option>
                <option value="Directeur-adjoint">Directeur Adjoint</option>
                <option value="Directeur">Directeur</option>
              </select>
              <button onClick={handleAddDoctor}>Ajouter</button>
            </div>
            

            
            <div className={styles.doctorsList}>
              <h3>Liste des Médecins</h3>
              {state.doctors
                .filter(doctor => 
                  !Object.values(state.assignments).flat().includes(doctor.id)
                )
                .map(doctor => (
                  <DoctorCard 
                    key={doctor.id} 
                    doctor={doctor} 
                    onEdit={() => {
                      setEditingDoctor(doctor);
                      setShowEditModal(true);
                    }}
                    onDelete={handleDeleteDoctor}
                    onRemoveFromLocation={() => {}}
                  />
                ))}
            </div>

            {/* Modal de confirmation de suppression */}
            {deleteConfirmation && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <div className={styles.modalHeader}>
                    <h2>Confirmer la suppression</h2>
                  </div>
                  <p>Êtes-vous sûr de vouloir supprimer ce médecin ?</p>
                  {Object.values(state.assignments)
                    .flat()
                    .includes(deleteConfirmation) && (
                    <p style={{ color: '#dc2626' }}>
                      Attention : Ce médecin est actuellement assigné à un lieu.
                    </p>
                  )}
                  <div className={styles.modalActions}>
                    <button
                      className={styles.cancelButton}
                      onClick={() => setDeleteConfirmation(null)}
                    >
                      Annuler
                    </button>
                    <button
                      className={styles.dangerButton}
                      onClick={confirmDeleteDoctor}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de modification */}
            {showEditModal && editingDoctor && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <div className={styles.modalHeader}>
                    <h2>Modifier le médecin</h2>
                  </div>
                  <div className={styles.form}>
                    <input
                      type="text"
                      placeholder="Nom du médecin"
                      value={editingDoctor.name}
                      onChange={(e) => setEditingDoctor({...editingDoctor, name: e.target.value})}
                    />
                    <select
                      value={editingDoctor.specialty}
                      onChange={(e) => setEditingDoctor({...editingDoctor, specialty: e.target.value})}
                    >
                      <option value="">Sélectionner un grade</option>
                      <option value="stagiaire">Stagiaire</option>
                      <option value="interne">Interne</option>
                      <option value="medecin">Médecin</option>
                      <option value="medecin-chef">Médecin Chef</option>
                      <option value="directeur-adjoint">Directeur Adjoint</option>
                      <option value="directeur">Directeur</option>
                    </select>
                  </div>
                  <div className={styles.modalActions}>
                    <button
                      className={styles.cancelButton}
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingDoctor(null);
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      className={styles.confirmButton}
                      onClick={() => {
                        handleUpdateDoctor();
                        setShowEditModal(false);
                      }}
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de confirmation de suppression de lieu */}
            {deleteLocationConfirmation && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <div className={styles.modalHeader}>
                    <h2>Confirmer la suppression</h2>
                  </div>
                  <p>Êtes-vous sûr de vouloir supprimer ce lieu ?</p>
                  {state.assignments[deleteLocationConfirmation]?.length > 0 && (
                    <p style={{ color: '#dc2626' }}>
                      Attention : Des médecins sont actuellement assignés à ce lieu.
                    </p>
                  )}
                  <div className={styles.modalActions}>
                    <button
                      className={styles.cancelButton}
                      onClick={() => setDeleteLocationConfirmation(null)}
                    >
                      Annuler
                    </button>
                    <button
                      className={styles.dangerButton}
                      onClick={confirmDeleteLocation}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de modification de lieu */}
            {showEditLocationModal && editingLocation && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <div className={styles.modalHeader}>
                    <h2>Modifier le lieu</h2>
                  </div>
                  <div className={styles.form}>
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
                      <option value="">Sélectionner un type</option>
                      <option value="repos">Repos</option>
                      <option value="intervention">Intervention</option>
                      <option value="absent">Absent</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                  <div className={styles.modalActions}>
                    <button
                      className={styles.cancelButton}
                      onClick={() => {
                        setShowEditLocationModal(false);
                        setEditingLocation(null);
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      className={styles.confirmButton}
                      onClick={() => {
                        handleUpdateLocation();
                        setShowEditLocationModal(false);
                      }}
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                <option value="autre">Autre</option>
              </select>
              <button onClick={handleAddLocation}>Ajouter</button>
            </div>
            
            <div className={styles.locationsList}>
              {state.locations.map(location => (
                <div key={location.id} className={styles.locationItem}>
                  <span>{location.name} ({location.type})</span>
                  <div>
                    <button onClick={() => {
                      setEditingLocation(location);
                      setShowEditLocationModal(true);
                    }}>✏️</button>
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