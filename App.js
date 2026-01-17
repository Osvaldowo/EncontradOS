import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, TextInput, Button, Alert, Dimensions, Image, ActivityIndicator } from 'react-native';
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
  // --- ESTADOS ---
  const [appReady, setAppReady] = useState(false); 
  const [location, setLocation] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [petName, setPetName] = useState('');
  const [lostPets, setLostPets] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  
  // Ref para no repetir notificaciones de la misma mascota en la misma sesión
  const notifiedPets = useRef(new Set());

  useEffect(() => {
    async function prepare() {
      try {
        // Identificador del dispositivo
        const id = Device.osBuildId || Device.modelName || 'anonymous';
        setDeviceId(id);

        // Pedir permisos
        let { status: gpsStatus } = await Location.requestForegroundPermissionsAsync();
        let { status: notifStatus } = await Notifications.requestPermissionsAsync();
        
        if (gpsStatus !== 'granted') {
          Alert.alert("Permiso denegado", "Se necesita GPS para el mapa.");
        } else {
          // Obtener posición inicial
          let loc = await Location.getCurrentPositionAsync({});
          setLocation(loc);

          // RASTREO EN TIEMPO REAL
          await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              distanceInterval: 10, 
            },
            (newLocation) => {
              setLocation(newLocation);
              // Verificar proximidad con la lista actual de mascotas
              verificarProximidad(newLocation, lostPets);
            }
          );
        }

        // Cargar datos iniciales
        await fetchPets();
        
        // Delay para lucir tu logo
        await new Promise(resolve => setTimeout(resolve, 2000)); 

      } catch (e) {
        console.warn(e);
      } finally {
        setAppReady(true);
      }
    }

    prepare();

    // SUSCRIPCIÓN EN TIEMPO REAL
    const subscription = supabase
      .channel('public:mascotas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mascotas' }, payload => {
        setLostPets(current => {
          const updatedList = [payload.new, ...current];
          // Si llega una nueva y estamos cerca, avisar de inmediato
          if (location) verificarProximidad(location, [payload.new]);
          return updatedList;
        });
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, [lostPets]);

  const fetchPets = async () => {
    const { data } = await supabase.from('mascotas').select('*');
    if (data) setLostPets(data);
  };

  // --- LÓGICA DE GEOCERCAS (200 metros) ---
  const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const verificarProximidad = (userLoc, petsArray) => {
    const RADIUS = 200; 
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

  // --- REPORTE SIN DUPLICADOS ---
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
      Alert.alert("¡Éxito!", "Reporte enviado.");
    } catch (err) {
      Alert.alert("Error", "No se pudo enviar el reporte.");
    }
  };

  // --- RENDERIZADO DE PANTALLA DE CARGA ---
  if (!appReady) {
    return (
      <View style={styles.splashContainer}>
        <Image 
          source={require('./assets/icono.jpg')} 
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#a5cc5d" style={{ marginTop: 20 }} />
        <Text style={styles.splashText}>Cargando mapa...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {location && (
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
                title={`¡${pet.nombre} perdido!`}
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
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>🐾 Reportar Mascota</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Ej: Husky con collar azul" 
            value={petName}
            onChangeText={setPetName}
          />
          <View style={{ gap: 10 }}>
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
  map: { width: '100%', height: '100%' },
  // Estilos de la Pantalla de Carga
  splashContainer: { 
    flex: 1, 
    backgroundColor: '#3d3430', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  splashLogo: { 
    width: 250, 
    height: 250 
  },
  splashText: { 
    color: '#fff', 
    marginTop: 10, 
    fontSize: 16, 
    fontWeight: 'bold',
    letterSpacing: 2
  },
  // Botones y Modales
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
  input: { borderBottomWidth: 1, borderColor: '#ddd', marginBottom: 25, padding: 10 }
});