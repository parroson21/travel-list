import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { ExploreComponent } from './components/explore/explore.component';
import { AuthComponent } from './components/auth/auth.component';
import { AdminComponent } from './components/admin/admin.component';

export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'explore', component: ExploreComponent },
    { path: 'login', component: AuthComponent },
    { path: 'admin', component: AdminComponent },
    { path: '**', redirectTo: '' }
];
