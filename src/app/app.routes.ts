import { Routes } from '@angular/router';
import { AuthComponent } from './components/auth/auth.component';
import { AdminComponent } from './components/admin/admin.component';
import { UserProfileComponent } from './components/user-profile/user-profile.component';
import { NotFoundComponent } from './components/not-found/not-found.component';

export const routes: Routes = [
    { path: '', component: UserProfileComponent },
    { path: 'user/:username', component: UserProfileComponent },
    { path: 'login', component: AuthComponent },
    { path: 'admin', component: AdminComponent },
    // Legacy explore redirects — keep these so old bookmarks don't 404
    { path: 'explore', redirectTo: '/', pathMatch: 'full' },
    { path: 'explore/:any', redirectTo: '/', pathMatch: 'full' },
    { path: 'not-found', component: NotFoundComponent },
    { path: '**', component: NotFoundComponent }
];
