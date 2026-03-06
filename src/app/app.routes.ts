import { Routes } from '@angular/router';
import { ProfileComponent } from './components/profile/profile.component';
import { ExploreComponent } from './components/explore/explore.component';
import { AuthComponent } from './components/auth/auth.component';
import { AdminComponent } from './components/admin/admin.component';
import { CountryDetailComponent } from './components/country-detail/country-detail.component';
import { UserProfileComponent } from './components/user-profile/user-profile.component';

export const routes: Routes = [
    { path: '', component: ProfileComponent },
    { path: 'explore', component: ExploreComponent },
    { path: 'explore/:countryId', component: CountryDetailComponent },
    { path: 'user/:uid', component: UserProfileComponent },
    { path: 'login', component: AuthComponent },
    { path: 'admin', component: AdminComponent },
    { path: '**', redirectTo: '' }
];
