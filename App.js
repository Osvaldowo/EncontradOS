import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, TextInput, Button, Alert, Dimensions } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabaseConfig'; 
import * as Device from 'expo-device'; 

// 1. Configuración de Notificaciones
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
  const [deviceId, setDeviceId] = useState('');
  
  // Ref para no repetir notificaciones de la misma mascota en la misma sesión
  const notifiedPets = useRef(new Set());

  useEffect(() => {
    // Identificador del dispositivo
    const id = Device.osBuildId || Device.modelName || 'anonymous';
    setDeviceId(id);

    let locationSubscription;

    (async () => {
      // Pedir permisos
      let { status: gpsStatus } = await Location.requestForegroundPermissionsAsync();
      let { status: notifStatus } = await Notifications.requestPermissionsAsync();
      
      if (gpsStatus !== 'granted') {
        Alert.alert("Permiso denegado", "Se necesita GPS para el mapa.");
        return;
      }

      // Obtener posición inicial
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);

      // RASTREO EN TIEMPO REAL: Verificar proximidad mientras el usuario camina
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10, // Cada 10 metros detecta movimiento
        },
        (newLocation) => {
          setLocation(newLocation);
          verificarProximidad(newLocation, lostPets);
        }
      );
    })();

    fetchPets();

    // ESCUCHAR SUPABASE: Solo actualiza el mapa, la notificación la maneja el Geofencing
    const subscription = supabase
      .channel('public:mascotas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mascotas' }, payload => {
        setLostPets(current => {
          const updatedList = [payload.new, ...current];
          // Si llega una nueva y estoy cerca, avisar de inmediato
          if (location) verificarProximidad(location, [payload.new]);
          return updatedList;
        });
      })
      .subscribe();

    return () => {
      if (locationSubscription) locationSubscription.remove();
      supabase.removeChannel(subscription);
    };
  }, [lostPets]);

  const fetchPets = async () => {
    const { data, error } = await supabase.from('mascotas').select('*');
    if (data) setLostPets(data);
  };

  // --- LÓGICA DE GEOCERCAS ---
  const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Radio de la Tierra en metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const verificarProximidad = (userLoc, petsArray) => {
    const RADIUS = 200; // 200 metros
    petsArray.forEach(pet => {
      const dist = calcularDistancia(
        userLoc.coords.latitude, userLoc.coords.longitude,
        pet.latitud, pet.longitud
      );

      if (dist <= RADIUS && !notifiedPets.current.has(pet.id)) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: "🐾 ¡Mascota Cerca!",
            body: `Entraste al perímetro de ${pet.nombre}. ¡Mantente alerta!`,
          },
          trigger: null,
        });
        notifiedPets.current.add(pet.id);
      }
    });
  };

  // --- LÓGICA DE REPORTE (CON VALIDACIÓN DE DUPLICADOS) ---
  const reportarMascota = async () => {
    if (!petName || !location) return Alert.alert("Error", "Faltan datos");

    try {
      const { data: existente } = await supabase
        .from('mascotas')
        .select('id')
        .eq('nombre', petName)
        .eq('user_id', deviceId);

      if (existente && existente.length > 0) {
        return Alert.alert("Reporte duplicado", "Ya reportaste a esta mascota.");
      }

      const { error } = await supabase.from('mascotas').insert([
        { 
          nombre: petName, 
          latitud: location.coords.latitude, 
          longitud: location.coords.longitude,
          user_id: deviceId 
        }
      ]);

      if (error) throw error;

      setModalVisible(false);
      setPetName('');
      Alert.alert("¡Enviado!", "Reporte compartido.");
    } catch (err) {
      Alert.alert("Error", "No se pudo enviar el reporte.");
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
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={true}
        >
          {lostPets.map(pet => (
            <React.Fragment key={pet.id}>
              <Marker 
                coordinate={{ latitude: pet.latitud, longitude: pet.longitud }}
                title={pet.nombre}
                pinColor="red"
              />
              <Circle 
                center={{ latitude: pet.latitud, longitude: pet.longitud }}
                radius={200}
                fillColor="rgba(255, 0, 0, 0.2)"
                strokeColor="rgba(255, 0, 0, 0.5)"
              />
            </React.Fragment>
          ))}
        </MapView>
      ) : (
        <View style={styles.loading}><Text>Localizando GPS...</Text></View>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>🐾 Reportar Mascota</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Nombre de la mascota" 
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fab: { 
    position: 'absolute', bottom: 40, alignSelf: 'center', 
    backgroundColor: '#ff4757', width: 70, height: 70, borderRadius: 35, 
    justifyContent: 'center', alignItems: 'center', elevation: 8
  },
  fabText: { color: 'white', fontSize: 35, fontWeight: 'bold' },
  modalContent: { 
    marginTop: '50%', marginHorizontal: 20, backgroundColor: 'white', 
    padding: 30, borderRadius: 25, elevation: 20
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderBottomWidth: 1, borderColor: '#ddd', marginBottom: 25, padding: 10, fontSize: 16 }
});