import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, TextInput, Button, Alert, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabaseConfig'; 

// 1. Configuración de Notificaciones para que se vean SIEMPRE
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [location, setLocation] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [petName, setPetName] = useState('');
  const [lostPets, setLostPets] = useState([]);

  useEffect(() => {
    (async () => {
      // Pedir permisos de GPS y Notificaciones al iniciar
      let { status: gpsStatus } = await Location.requestForegroundPermissionsAsync();
      let { status: notifStatus } = await Notifications.requestPermissionsAsync();
      
      if (gpsStatus !== 'granted') {
        Alert.alert("Permiso denegado", "Necesitamos tu ubicación para mostrarte el mapa.");
        return;
      }
      
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();

    // 2. Cargar mascotas iniciales de Supabase
    fetchPets();

    // 3. EL BROADCAST: Escuchar en tiempo real cuando alguien agrega una mascota
    const subscription = supabase
      .channel('public:mascotas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mascotas' }, payload => {
        console.log('¡Broadcast recibido!', payload.new);
        
        // Actualizar el mapa inmediatamente para todos
        setLostPets(current => [payload.new, ...current]);

        // Disparar la alerta sonora y visual
        Notifications.scheduleNotificationAsync({
          content: {
            title: "🚨 ¡NUEVA ALERTA DE MASCOTA!",
            body: `Se acaba de reportar a ${payload.new.nombre} cerca de tu posición.`,
          },
          trigger: null,
        });
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  const fetchPets = async () => {
    const { data, error } = await supabase.from('mascotas').select('*');
    if (data) setLostPets(data);
    if (error) console.log("Error al cargar:", error.message);
  };

  const reportarMascota = async () => {
    if (!petName || !location) return Alert.alert("Espera", "Escribe un nombre o descripción.");

    const { error } = await supabase
      .from('mascotas')
      .insert([
        { 
          nombre: petName, 
          latitud: location.coords.latitude, 
          longitud: location.coords.longitude 
        }
      ]);

    if (error) {
      Alert.alert("Error de conexión", error.message);
    } else {
      setModalVisible(false);
      setPetName('');
      Alert.alert("¡Enviado!", "Tu reporte ha sido compartido con la comunidad.");
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
            // Solo dibujar si tiene coordenadas válidas
            pet.latitud && pet.longitud && (
              <Marker 
                key={pet.id}
                coordinate={{ latitude: pet.latitud, longitude: pet.longitud }}
                title={`¡${pet.nombre} perdido!`}
                pinColor="red"
              />
            )
          ))}
        </MapView>
      ) : (
        <View style={styles.loading}><Text>Localizando GPS...</Text></View>
      )}

      {/* Botón flotante para reportar */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Ventana para ingresar el reporte */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>🐾 Reportar Mascota</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Ej: Golden Retriever con collar" 
            value={petName}
            onChangeText={setPetName}
          />
          <View style={{gap: 10}}>
            <Button title="Lanzar Alerta" onPress={reportarMascota} color="#ff4757" />
            <Button title="Cancelar" onPress={() => setModalVisible(false)} color="#2f3542" />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ESTA ES LA PARTE QUE TE FALTABA Y CAUSABA EL ERROR
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fab: { 
    position: 'absolute', bottom: 40, alignSelf: 'center', 
    backgroundColor: '#ff4757', width: 70, height: 70, borderRadius: 35, 
    justifyContent: 'center', alignItems: 'center', elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65
  },
  fabText: { color: 'white', fontSize: 35, fontWeight: 'bold' },
  modalContent: { 
    marginTop: '50%', marginHorizontal: 20, backgroundColor: 'white', 
    padding: 30, borderRadius: 25, elevation: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 13
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#2f3542' },
  input: { borderBottomWidth: 1, borderColor: '#ddd', marginBottom: 25, padding: 10, fontSize: 16 }
});