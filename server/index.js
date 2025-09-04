// Simple Express server for dispatch
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Example API route
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});


const fs = require('fs');
const path = require('path');

// Chemin vers le fichier de données
const DATA_FILE = path.join(__dirname, 'data.json');

// Fonction pour charger les données
function loadData() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading data:', error);
    return {
      doctors: [],
      locations: [
        { id: 'repos', name: "Repos", type: "repos" },
        { id: 'intervention', name: "Intervention", type: "intervention" },
        { id: 'absent', name: "Absent", type: "absent" }
      ],
      assignments: {
        repos: [],
        intervention: [],
        absent: []
      }
    };
  }
}

// Fonction pour sauvegarder les données
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// État partagé en mémoire (source de vérité)
let sharedState = loadData();

// Appliquer une action sur l'état partagé (mêmes types que le reducer du front)
function applyAction(state, action) {
  switch (action.type) {
    case 'LOAD_DATA':
      return { ...action.payload };
    case 'ADD_DOCTOR':
      const newDoctor = {
        id: Date.now(),
        name: action.payload.name,
        specialty: action.payload.specialty
      };
      return {
        ...state,
        doctors: [...state.doctors, newDoctor]
      };
    case 'UPDATE_DOCTOR':
      return {
        ...state,
        doctors: state.doctors.map(doctor =>
          doctor.id === action.payload.id ? { ...doctor, ...action.payload } : doctor
        )
      };
    case 'DELETE_DOCTOR': {
      const newAssignments = { ...state.assignments };
      Object.keys(newAssignments).forEach(locationId => {
        newAssignments[locationId] = newAssignments[locationId].filter(
          doctorId => doctorId !== action.payload
        );
      });
      return {
        ...state,
        doctors: state.doctors.filter(doctor => doctor.id !== action.payload),
        assignments: newAssignments
      };
    }
    case 'ADD_LOCATION': {
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
    }
    case 'UPDATE_LOCATION':
      return {
        ...state,
        locations: state.locations.map(location =>
          location.id === action.payload.id ? { ...location, ...action.payload } : location
        )
      };
    case 'DELETE_LOCATION': {
      const { [action.payload]: removed, ...remainingAssignments } = state.assignments;
      return {
        ...state,
        locations: state.locations.filter(location => location.id !== action.payload),
        assignments: remainingAssignments
      };
    }
    case 'MOVE_DOCTOR': {
      const { doctorId, source, destination } = action.payload;
      const updatedAssignments = { ...state.assignments };
      Object.keys(updatedAssignments).forEach(locationId => {
        updatedAssignments[locationId] = updatedAssignments[locationId].filter(id => id !== doctorId);
      });
      if (destination && updatedAssignments[destination]) {
        updatedAssignments[destination] = [...updatedAssignments[destination], doctorId];
      }
      return {
        ...state,
        assignments: updatedAssignments
      };
    }
    case 'REMOVE_DOCTOR_FROM_LOCATION': {
      const { doctorId: docId, locationId } = action.payload;
      const updatedAssignments = { ...state.assignments };
      if (updatedAssignments[locationId]) {
        updatedAssignments[locationId] = updatedAssignments[locationId].filter(id => id !== docId);
      }
      return {
        ...state,
        assignments: updatedAssignments
      };
    }
    default:
      return state;
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Envoyer l'état partagé au nouveau client
  socket.emit('sync', sharedState);

  // Recevoir une action d'un client, l'appliquer, puis diffuser le nouvel état
  socket.on('action', (action) => {
    sharedState = applyAction(sharedState, action);
    // Sauvegarder les changements dans le fichier
    saveData(sharedState);
    io.emit('sync', sharedState); // Diffuser à tous (y compris l'émetteur)
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Dispatch server with Socket.io running on port ${PORT}`);
});
