import { Injectable } from '@angular/core';
import { Auth, GoogleAuthProvider, signOut, user, User, signInWithRedirect, getRedirectResult, signInWithPopup } from '@angular/fire/auth';
import { Observable, map, tap } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    user$: Observable<User | null>;
    isAdmin$: Observable<boolean>;

    constructor(private auth: Auth) {
        this.user$ = user(this.auth).pipe(
            tap(u => console.log('Auth State Change:', u ? u.email : 'No User'))
        );
        this.isAdmin$ = this.user$.pipe(
            map(u => {
                const email = u?.email?.toLowerCase();
                return email === 'parroson21@gmail.com' || email === 'parrson21@gmail.com';
            })
        );

        // Handle redirect result (for cases where popup fails and we fall back)
        getRedirectResult(this.auth).then(result => {
            if (result) {
                console.log('Redirect Login Success:', result.user.email);
            }
        }).catch(error => {
            console.error('Redirect Login Error:', error);
        });
    }

    async loginWithGoogle() {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        try {
            // Try popup first
            return await signInWithPopup(this.auth, provider);
        } catch (error: any) {
            // Fallback to redirect if popup is blocked or fails
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-by-user') {
                return await signInWithRedirect(this.auth, provider);
            }
            throw error;
        }
    }

    async logout() {
        return await signOut(this.auth);
    }
}
