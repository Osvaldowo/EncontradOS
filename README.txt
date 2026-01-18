# 🐾 EncontradOS | Pet Recovery Radar

**EncontradOS** is a community-driven mobile application designed to reconnect lost pets with their families using real-time geofencing and instant proximity alerts. Developed for a high-stakes Hackathon environment, the app features a unique RPG/Pixel-art aesthetic to turn a stressful search into a collaborative community mission.

---

## 🚀 Key Features

* **Real-time Pet Radar:** An interactive satellite map that visualizes active search zones for lost pets in your current area.
* **Smart Geofencing:** Our proprietary algorithm automatically sends push notifications when a user enters a 200m radius of a reported lost pet.
* **RPG Pet Profiles:** Interactive "Fichas" (Detail cards) featuring the pet's photo, description, and an instant "I FOUND IT!" call button.
* **Cloud-Powered Reporting:** High-speed photo uploads from the device gallery directly to our Supabase Storage.
* **Live Synchronization:** Powered by Supabase Realtime, new reports appear on all users' maps instantly without refreshing the app.

---

## 🛠️ Tech Stack

* **Framework:** React Native with Expo (SDK 54).
* **Backend:** Supabase (PostgreSQL Database & S3 Storage).
* **Location Services:** Expo Location with real-time tracking logic.
* **Notifications:** Expo Notifications for background proximity alerts.
* **UI/UX:** Custom "Pixel-Art" theme built with React Native StyleSheet and specialized assets.

---

## 📋 Prerequisites

To run this project locally, you need:
1.  **Node.js** (v18.0.0 or higher).
2.  **Expo Go** app installed on your physical iOS or Android device (Highly recommended over emulators for GPS testing).
3.  **Git** installed for repository management.

---

## ⚙️ Installation & Setup

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd EncontradOS

### 2. Install Required Dependencies
This project uses several native modules. Run the following command to ensure all libraries are correctly installed:
```bash
npx expo install react-native-maps expo-location expo-notifications expo-image-picker expo-device @supabase/supabase-js base64-arraybuffer expo-linking expo-system-ui

### 3. Database Configuration
Ensure your supabaseConfig.js file is in the root directory. This file connects the app to our live database:
```JavaScript
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');

🏃 Execution Guide
### 1. Start the Metro Bundler
We use the tunnel flag to bypass local firewall restrictions and ensure global connectivity between the server and your mobile device:
```bash
npx expo start --tunnel

### 2. Connect your Device
--Open the Expo Go app on your phone.

--Scan the QR Code generated in your terminal or browser.

--Grant Location (set to "Always Allow" for geofencing) and Notification permissions when prompted.

🧪 How to Demo (Step-by-Step)
--Create a Report: Press the "+" button on the map. Fill in the pet's name, contact number, and upload a photo from your gallery.

--Verify Real-time Sync: Notice how the red pin (Pet Marker) appears instantly on the map with a 200m red circle (Geofence).

--Test Proximity Alert: If you are within 200m of the marker, your device will immediately trigger a "🐾 Pet Nearby!" notification.

--Interact with the Ficha: Tap the pet's marker to open the RPG-style detail card. From there, you can see the full photo and use the "¡LO ENCONTRÉ!" button to call the owner directly.

🎓 Team EncontradOS
Backend & Logic: [Your Team Name/Names]

UI/UX & Aesthetics: [Your Team Name/Names]

Judge Note: This application is optimized for Expo Go to ensure maximum stability and cross-platform performance during the live demonstration. Please ensure "Location Services" are active for the best experience.
