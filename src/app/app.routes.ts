import { Routes } from '@angular/router';
import { ExploreComponent } from './components/explore/explore.component';
import { AuthComponent } from './components/auth/auth.component';
import { AdminComponent } from './components/admin/admin.component';
import { CountryDetailComponent } from './components/country-detail/country-detail.component';
import { UserProfileComponent } from './components/user-profile/user-profile.component';
import { NotFoundComponent } from './components/not-found/not-found.component';

export const routes: Routes = [
    { path: '', component: UserProfileComponent },
    { path: 'explore', component: ExploreComponent },
    { path: 'explore/:countryId', component: CountryDetailComponent },
    { path: 'user/:username', component: UserProfileComponent },
    { path: 'login', component: AuthComponent },
    { path: 'admin', component: AdminComponent },
    { path: 'not-found', component: NotFoundComponent },
    { path: '**', component: NotFoundComponent }
];
