import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth, browserLocalPersistence, initializeAuth, browserPopupRedirectResolver } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';

const firebaseConfig = {
  apiKey: "AIzaSyBMswE5sRd1wfiP99YsSRHAnb7WiiseqHk",
  authDomain: "travel-list-4e4f4.firebaseapp.com",
  projectId: "travel-list-4e4f4",
  storageBucket: "travel-list-4e4f4.firebasestorage.app",
  messagingSenderId: "250549244937",
  appId: "1:250549244937:web:a3d077fa42e8310db554d8",
  measurementId: "G-K5VYC4BXKS"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(),
    provideFirebaseApp(() => {
      const app = initializeApp(firebaseConfig);
      return app;
    }),
    provideAuth(() => {
      const auth = initializeAuth(initializeApp(firebaseConfig), {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver
      });
      return auth;
    }),
    provideFirestore(() => getFirestore())
  ]
};
