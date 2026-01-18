import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Dimensions, Image, ActivityIndicator } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabaseConfig'; 
import ReportModal from './ReportModal';
import PetDetailModal from './PetDetailModal';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [appReady, setAppReady] = useState(false); 
  const [location, setLocation] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [lostPets, setLostPets] = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  
  // Usamos una Ref para la lista de mascotas para evitar que el GPS se reinicie cada vez que alguien sube un perro
  const lostPetsRef = useRef([]);
  const notifiedPets = useRef(new Set());

  // 1. CARGA INICIAL Y GPS (Solo corre una vez [])
  useEffect(() => {
    async function prepare() {
      try {
        let { status: gpsStatus } = await Location.requestForegroundPermissionsAsync();
        await Notifications.requestPermissionsAsync();
        
        if (gpsStatus !== 'granted') {
          Alert.alert("Permiso denegado", "Se necesita GPS para el mapa.");
        } else {
          let loc = await Location.getCurrentPositionAsync({});
          setLocation(loc);

          // RASTREO: Se configura una sola vez
          await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, distanceInterval: 10 },
            (newLocation) => {
              setLocation(newLocation);
              // Compara la ubicación nueva con la lista de mascotas guardada en la Ref
              verificarProximidad(newLocation, lostPetsRef.current);
            }
          );
        }

        await fetchPets();
        setTimeout(() => setAppReady(true), 2000); 

      } catch (e) {
        console.warn("Error en prepare:", e);
        setAppReady(true);
      }
    }

    prepare();

    // 2. ESCUCHA DE SUPABASE (Solo una vez [])
    const subscription = supabase
      .channel('public:mascotas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mascotas' }, payload => {
        const newPet = payload.new;
        setLostPets(current => {
          const updated = [newPet, ...current];
          lostPetsRef.current = updated; // Actualizamos la Ref para el GPS
          return updated;
        });
        
        // Notificación inmediata si la nueva mascota está cerca
        if (location) verificarProximidad(location, [newPet]);
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  const fetchPets = async () => {
    const { data } = await supabase.from('mascotas').select('*');
    if (data) {
      setLostPets(data);
      lostPetsRef.current = data;
    }
  };

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
      if (!pet.latitud || !pet.longitud) return;

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

  if (!appReady) {
    return (
      <View style={styles.splashContainer}>
        {/* VERIFICA: ¿Tu logo se llama icono.png y está en assets? */}
        <Image 
          source={require('./assets/icono.png')} 
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
      {/* 1. MAPA SATELITAL (Capa de fondo) */}
      {location && (
        <MapView 
          style={styles.map} 
          mapType="satellite" 
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
              {pet.latitud && pet.longitud && (
                <>
                  {/* MARCADOR INTERACTIVO */}
                  <Marker 
                    coordinate={{ latitude: pet.latitud, longitude: pet.longitud }}
                    onPress={() => {
                      setSelectedPet(pet);    
                      setDetailVisible(true); 
                    }}      
                  >
                    <Image 
                      source={require('./assets/pin-red.png')} 
                      style={{ width: 45, height: 45 }} 
                      resizeMode="contain" 
                    />  
                  </Marker>

                  {/* CÍRCULO DE PROXIMIDAD */}
                  <Circle 
                    center={{ latitude: pet.latitud, longitude: pet.longitud }}
                    radius={200}
                    fillColor="rgba(255, 0, 0, 0.2)"
                    strokeColor="rgba(255, 0, 0, 0.5)"
                  />
                </>
              )}
            </React.Fragment>
          ))}
        </MapView>
      )}

      {/* 2. BOTÓN FLOTANTE "+" (Único punto de acción) */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* 3. MODALES DE FUNCIONALIDAD */}
      
      {/* Modal para CREAR reporte (con foto de galería) */}
      <ReportModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        userLocation={location} 
      />

      {/* Modal para VER detalles (al tocar un pin) */}
      <PetDetailModal 
        visible={detailVisible} 
        pet={selectedPet} 
        onClose={() => setDetailVisible(false)} 
      />
    </View>
  );
}

// ESTILOS LIMPIOS
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#3d3430' 
  },
  map: { 
    width: '100%', 
    height: '100%' 
  },
  fab: { 
    position: 'absolute', 
    bottom: 50, // Elevado un poco para que sea cómodo al pulgar
    alignSelf: 'center', 
    backgroundColor: '#ff4757', // Rojo vibrante para resaltar
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    borderWidth: 3,
    borderColor: '#fff' // Borde blanco para que resalte sobre el mapa satelital
  },
  fabText: { 
    color: 'white', 
    fontSize: 40, 
    fontWeight: 'bold',
    lineHeight: 45
  },
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
  }
});