import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, TextInput, Button } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { db } from './firebaseConfig'; 
import { collection, addDoc, query, onSnapshot } from "firebase/firestore";
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

const GEOFENCING_TASK_NAME = 'ALERTA_MASCOTA_CERCANA';

// CONFIGURAR CÓMO SE VEN LAS NOTIFICACIONES
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ESTA FUNCIÓN SE EJECUTA CUANDO ENTRAS EN UNA ZONA
TaskManager.defineTask(GEOFENCING_TASK_NAME, ({ data: { eventType, region }, error }) => {
  if (error) return;

  if (eventType === Location.GeofencingEventType.Enter) {
    Notifications.scheduleNotificationAsync({
      content: {
        title: "¡Mascota perdida cerca! 🐾",
        body: `Estás en la zona donde se vio a una mascota. ¡Mantente alerta!`,
        data: { region },
      },
      trigger: null, // Envío inmediato
    });
  }
});

export default function App() {
  const [location, setLocation] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [petName, setPetName] = useState('');
  const [lostPets, setLostPets] = useState([]);

  useEffect(() => {
  const setupGeofencing = async () => {
    // Pedir permisos de notificaciones y ubicación en segundo plano
    const { status: authStatus } = await Notifications.requestPermissionsAsync();
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    
    if (bgStatus === 'granted' && lostPets.length > 0) {
      // Convertimos los perritos de Firebase en "Cercas" de 200 metros
      const regions = lostPets.map(pet => ({
        identifier: pet.id,
        latitude: pet.latitud,
        longitude: pet.longitud,
        radius: 200, // Radio en metros
        notifyOnEnter: true,
        notifyOnExit: false,
      }));

      await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, regions);
      console.log("Geofencing activado para", regions.length, "mascotas");
    }
  };

  setupGeofencing();
}, [lostPets]); // Se actualiza cada vez que alguien sube una mascota nueva

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();

    // ESCUCHAR MASCOTAS EN TIEMPO REAL
    const q = query(collection(db, "mascotas"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const pets = [];
      querySnapshot.forEach((doc) => {
        pets.push({ id: doc.id, ...doc.data() });
      });
      setLostPets(pets);
    });
    return () => unsubscribe();
  }, []);

  const reportarMascota = async () => {
    try {
      await addDoc(collection(db, "mascotas"), {
        nombre: petName,
        latitud: location.coords.latitude,
        longitud: location.coords.longitude,
        timestamp: new Date()
      });
      setModalVisible(false);
      setPetName('');
      alert("¡Alerta enviada a la comunidad!");
    } catch (e) {
      console.error("Error al subir: ", e);
    }
  };

  return (
    <View style={styles.container}>
      {location && (
        <MapView 
          style={styles.map} 
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          showsUserLocation={true}
        >
          {lostPets.map(pet => (
            <Marker 
              key={pet.id}
              coordinate={{ latitude: pet.latitud, longitude: pet.longitud }}
              title={`¡${pet.nombre} perdido!`}
              pinColor="red"
            />
          ))}
        </MapView>
      )}

      {/* BOTÓN FLOTANTE ESTILO POKEMON GO */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* MODAL DE REPORTE */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Reportar Mascota Perdida</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Nombre o descripción (ej: Perro Husky)" 
            value={petName}
            onChangeText={setPetName}
          />
          <Button title="Lanzar Alerta" onPress={reportarMascota} color="#ff4757" />
          <Button title="Cancelar" onPress={() => setModalVisible(false)} color="#2f3542" />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  fab: { 
    position: 'absolute', bottom: 30, alignSelf: 'center',
    backgroundColor: '#ff4757', width: 70, height: 70, borderRadius: 35,
    justifyContent: 'center', alignItems: 'center', elevation: 5
  },
  fabText: { color: 'white', fontSize: 40, fontWeight: 'bold' },
  modalContent: { 
    marginTop: 150, marginHorizontal: 20, backgroundColor: 'white', 
    padding: 30, borderRadius: 20, elevation: 10 
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  input: { borderBottomWidth: 1, marginBottom: 20, padding: 5 }
});