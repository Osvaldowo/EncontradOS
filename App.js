import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Image, ActivityIndicator, FlatList, Modal } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabaseConfig'; 

// Importación de Componentes de UI (Merge Front-end)
import ReportModal from './ReportModal';
import PetDetailModal from './PetDetailModal';
import { COLORS, THEME, MAP_STYLE } from './Theme';

// Importación de Lógica (Separación de Capas)
import { cargarMapa, abrirGestionMascotas, ejecutarEliminacion } from './backend';

// Configuración de Notificaciones actualizada
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, 
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  // --- ESTADOS DE LA APP ---
  const [appReady, setAppReady] = useState(false); 
  const [location, setLocation] = useState(null);
  const [deviceId, setDeviceId] = useState('');
  
  // --- ESTADOS DE MODALES ---
  const [modalVisible, setModalVisible] = useState(false); // Reporte
  const [detailVisible, setDetailVisible] = useState(false); // Ficha Mascota
  const [drawerVisible, setDrawerVisible] = useState(false); // Mis Alertas
  
  // --- ESTADOS DE DATOS ---
  const [lostPets, setLostPets] = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [userPets, setUserPets] = useState([]);

  const lostPetsRef = useRef([]); // Referencia para el tracker de GPS
  const notifiedPets = useRef(new Set());

  useEffect(() => {
    async function prepare() {
      try {
        // 1. Identificador único del dispositivo
        const id = Device.osBuildId || Device.modelName || 'anonymous';
        setDeviceId(id);

        // 2. Gestión de Permisos (GPS, Notif, Galería)
        let { status: gpsStatus } = await Location.requestForegroundPermissionsAsync();
        await Notifications.requestPermissionsAsync();
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (gpsStatus !== 'granted') {
          Alert.alert("Acceso Denegado", "Se necesita GPS para el funcionamiento del radar.");
        } else {
          // Posición inicial
          let loc = await Location.getCurrentPositionAsync({});
          setLocation(loc);

          // RASTREO EN TIEMPO REAL (Geocerca de 200m)
          await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, distanceInterval: 10 },
            (newLocation) => {
              setLocation(newLocation);
              verificarProximidad(newLocation, lostPetsRef.current);
            }
          );
        }

        await fetchAndSetPets(); // Carga inicial desde Supabase
        setTimeout(() => setAppReady(true), 2000); // Splash timing

      } catch (e) {
        console.warn("Error en prepare:", e);
        setAppReady(true);
      }
    }
    prepare();

    // 3. SUSCRIPCIÓN EN TIEMPO REAL (Supabase Realtime)
    const subscription = supabase
      .channel('public:mascotas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mascotas' }, payload => {
        const newPet = payload.new;
        setLostPets(current => {
          const updated = [newPet, ...current];
          lostPetsRef.current = updated;
          return updated;
        });
        if (location) verificarProximidad(location, [newPet]);
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  // --- LÓGICA DE DATOS ---
  const fetchAndSetPets = async () => {
    await cargarMapa((data) => {
      setLostPets(data);
      lostPetsRef.current = data;
    });
  };

  const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distancia en metros
  };

  const verificarProximidad = (userLoc, petsArray) => {
    const RADIUS = 200; 
    petsArray.forEach(pet => {
      if (!pet.latitud || !pet.longitud) return;
      const dist = calcularDistancia(userLoc.coords.latitude, userLoc.coords.longitude, pet.latitud, pet.longitud);
      if (dist <= RADIUS && !notifiedPets.current.has(pet.id)) {
        Notifications.scheduleNotificationAsync({
          content: { title: "🐾 ¡Mascota Cerca!", body: `Entraste al área de búsqueda de ${pet.nombre}.` },
          trigger: null,
        });
        notifiedPets.current.add(pet.id);
      }
    });
  };

  // --- RENDER SPLASH ---
  if (!appReady) {
    return (
      <View style={styles.splashContainer}>
        <Image source={require('./assets/icono.png')} style={styles.splashLogo} resizeMode="contain" />
        <ActivityIndicator size="large" color={COLORS.accentGreen} style={{ marginTop: 20 }} />
        <Text style={styles.splashText}>INICIALIZANDO RADAR...</Text>
      </View>
    );
  }

  // --- RENDER MAPA Y UI ---
  return (
    <View style={styles.container}>
      {/* Botón de Gestión de Reportes Propios */}
      <TouchableOpacity 
        style={styles.menuBtn} 
        onPress={() => abrirGestionMascotas(deviceId, setUserPets, setDrawerVisible)}
      >
        <Text style={{ fontSize: 24 }}>📜</Text>
      </TouchableOpacity>

      {location && (
        <MapView 
          style={styles.map} 
          mapType="satellite" 
          customMapStyle={MAP_STYLE}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={true}
        >
          {lostPets.map(pet => (
            pet.latitud && pet.longitud && (
              <React.Fragment key={pet.id}>
                <Marker 
                  coordinate={{ latitude: pet.latitud, longitude: pet.longitud }}
                  onPress={() => { setSelectedPet(pet); setDetailVisible(true); }}      
                >
                  <Image source={require('./assets/pin-red.png')} style={{ width: 40, height: 40 }} resizeMode="contain" />  
                </Marker>
                <Circle 
                  center={{ latitude: pet.latitud, longitude: pet.longitud }}
                  radius={200}
                  fillColor="rgba(164, 198, 57, 0.2)"
                  strokeColor={COLORS.accentGreen}
                />
              </React.Fragment>
            )
          ))}
        </MapView>
      )}

      {/* Botón Principal "+" */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* MODALES EXTERNOS (FRONT-END MERGE) */}
      <ReportModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        userLocation={location} 
        deviceId={deviceId} 
        onRefresh={fetchAndSetPets} 
      />
      <PetDetailModal 
        visible={detailVisible} 
        pet={selectedPet} 
        onClose={() => setDetailVisible(false)} 
      />

      {/* GESTIÓN DE MIS ALERTAS (Estética RPG) */}
      <Modal visible={drawerVisible} animationType="fade" transparent={true}>
        <View style={styles.drawerOverlay}>
          <View style={[THEME.infoCard, styles.drawerContent]}>
            <Text style={THEME.headerTitle}>MIS ALERTAS</Text>
            <FlatList
              data={userPets}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.petItem}>
                  <Text style={styles.petItemName}>{item.nombre}</Text>
                  <TouchableOpacity onPress={() => ejecutarEliminacion(item.id, userPets, setUserPets, fetchAndSetPets)}>
                    <Text style={{fontSize: 20}}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
            <TouchableOpacity style={THEME.rpgButton} onPress={() => setDrawerVisible(false)}>
              <Text style={{color: '#FFF', fontFamily: 'monospace'}}>CERRAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  map: { width: '100%', height: '100%' },
  menuBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10, backgroundColor: COLORS.parchmentDark, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: COLORS.borderDark, elevation: 5 },
  fab: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#ff4757', width: 75, height: 75, borderRadius: 40, justifyContent: 'center', alignItems: 'center', elevation: 10, borderWidth: 3, borderColor: '#fff' },
  fabText: { color: 'white', fontSize: 40, fontWeight: 'bold' },
  splashContainer: { flex: 1, backgroundColor: COLORS.bgDark, justifyContent: 'center', alignItems: 'center' },
  splashLogo: { width: 220, height: 220 },
  splashText: { color: '#fff', marginTop: 15, fontFamily: 'monospace', fontWeight: 'bold' },
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  drawerContent: { width: '85%', maxHeight: '70%' },
  petItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: COLORS.parchmentDark },
  petItemName: { fontFamily: 'monospace', fontSize: 16 }
});