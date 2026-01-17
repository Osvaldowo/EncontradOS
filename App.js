import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, TextInput, Button, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { db } from './firebaseConfig'; 
import { collection, addDoc, query, onSnapshot, serverTimestamp } from "firebase/firestore"; 

// Corregir advertencia de iOS
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBanner: true,
  }),
});

export default function App() {
  const [location, setLocation] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [petName, setPetName] = useState('');
  const [lostPets, setLostPets] = useState([]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();

    // ESCUCHAR EN TIEMPO REAL CON MANEJO DE ERRORES
    const q = query(collection(db, "mascotas"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pets = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // SEGURIDAD: Solo agregar si tiene coordenadas (Evita el error de la imagen roja)
        if (data.latitud && data.longitud) {
          pets.push({ id: doc.id, ...data });
        }
      });
      console.log("Mascotas cargadas:", pets.length);
      setLostPets(pets);
    }, (error) => {
      console.error("Error al leer Firebase:", error);
    });

    return () => unsubscribe();
  }, []);

  const reportarMascota = async () => {
    if (!petName) return Alert.alert("Error", "Pon un nombre");
    if (!location) return Alert.alert("Error", "Esperando GPS...");

    console.log("🚀 Intentando enviar a Firebase...");
    try {
      const docRef = await addDoc(collection(db, "mascotas"), {
        nombre: petName,
        latitud: location.coords.latitude,
        longitud: location.coords.longitude,
        timestamp: serverTimestamp() // Usar hora del servidor
      });
      console.log("✅ ÉXITO: ID", docRef.id);
      setModalVisible(false);
      setPetName('');
      Alert.alert("¡Éxito!", "Alerta lanzada a la comunidad");
    } catch (e) {
      console.error("❌ ERROR AL GUARDAR:", e);
      Alert.alert("Error", "No se pudo subir. Revisa las reglas de Firebase.");
    }
  };

  return (
    <View style={styles.container}>
      {location ? (
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
            // VALIDACIÓN EXTRA: Si lat/lng no existen, no renderizar Marker
            pet.latitud && pet.longitud && (
              <Marker 
                key={pet.id}
                coordinate={{ latitude: pet.latitud, longitude: pet.longitud }}
                title={`¡${pet.nombre} perdido!`}
              />
            )
          ))}
        </MapView>
      ) : (
        <View style={styles.loading}><Text>Cargando Mapa y GPS...</Text></View>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Reportar Mascota</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Nombre (Ej: Husky con collar)" 
            value={petName}
            onChangeText={setPetName}
          />
          <Button title="Lanzar Alerta" onPress={reportarMascota} color="#ff4757" />
          <Button title="Cerrar" onPress={() => setModalVisible(false)} color="#2f3542" />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', bottom: 30, alignSelf: 'center', backgroundColor: '#ff4757', width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabText: { color: 'white', fontSize: 40, fontWeight: 'bold' },
  modalContent: { marginTop: 150, marginHorizontal: 20, backgroundColor: 'white', padding: 30, borderRadius: 20, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  input: { borderBottomWidth: 1, marginBottom: 20, padding: 5 }
});