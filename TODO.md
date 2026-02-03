# Travel List App - TODO

**Date:** February 2, 2026  
**Last Updated:** 10:42 PM

---

## 🔴 HIGH PRIORITY

### 1. **Fix Country Data Set**
- [ ] Find a better/cleaner country dataset
  - Current issue: Using two separate CSVs (`countries.csv` for metadata and another for coordinates)
  - Need: Single comprehensive CSV with:
    - Country name
    - ISO code
    - Latitude/longitude coordinates
    - Continent/region
    - Possibly population, capital, etc.
  - Potential sources to explore:
    - [REST Countries API](https://restcountries.com/)
    - [Natural Earth Data](https://www.naturalearthdata.com/)
    - [World Bank Open Data](https://data.worldbank.org/)
    - [GeoNames](https://www.geonames.org/)

### 2. **Re-seed Database**
- [ ] Once new dataset is found, re-run the country seeding in Admin panel
- [ ] Verify all countries have valid coordinates (no NaN or 0,0 values)
- [ ] Confirm continents are properly categorized
- [ ] Test that continent filtering works correctly

---

## 🟡 MEDIUM PRIORITY

### 3. **Testing & Validation**
- [ ] Test the POI tab functionality
- [ ] Verify POI seeding works correctly
- [ ] Test search functionality on both Countries and POIs tabs
- [ ] Test continent filtering on both tabs
- [ ] Verify "Add to List" / "Visited" tracking persists correctly

### 4. **UI/UX Improvements**
- [ ] Consider adding a count of visited countries/POIs
- [ ] Maybe add a progress indicator (e.g., "45/197 countries visited")
- [ ] Consider adding country flags (could use flag emoji or API)
- [ ] Add loading states for when data is being fetched

### 5. **Performance**
- [ ] Review bundle size warning (currently 729.55 kB vs 500 kB budget)
- [ ] Consider lazy loading POI data only when tab is active
- [ ] Optimize papaparse import (currently showing CommonJS warning)

---

## 🟢 LOW PRIORITY / FUTURE ENHANCEMENTS

### 6. **Features to Consider**
- [ ] Add a map view showing visited countries/POIs
- [ ] Export visited list as PDF or CSV
- [ ] Add photos/images for countries and POIs
- [ ] Social sharing of travel achievements
- [ ] Statistics page (most visited continent, etc.)
- [ ] Add notes/dates for each visit

### 7. **Code Quality**
- [ ] Add error handling for failed data loads
- [ ] Add unit tests for components
- [ ] Consider adding analytics/tracking
- [ ] Review Firestore security rules

---

## ✅ COMPLETED

- [x] Fixed `localeCompare` crash with safe navigation
- [x] Resolved NaN latitude/longitude issues
- [x] Added continent model and Firestore collection
- [x] Implemented continent filtering with dropdown
- [x] Added continent-based grouping and sorting
- [x] Created POI tab with same filtering functionality
- [x] Updated to Angular 21 control flow syntax (@if, @for)
- [x] Separated template/styles into dedicated files
- [x] Deployed to Firebase Hosting

---

## 📝 NOTES

### Current Data Structure
- **Countries CSV**: `countries.csv` (metadata with continent info)
- **Coordinates CSV**: `countries.csv` (latitude/longitude data)
- **POIs CSV**: `whc-sites-2025.csv` (UNESCO World Heritage Sites)

### Known Issues
- Some countries may have missing or incorrect coordinates
- Need to verify all 197 countries are properly represented
- Bundle size exceeds recommended limit

### Firebase Collections
- `countries` - Country data
- `continents` - Continent reference data (auto-seeded)
- `pois` - Points of Interest (UNESCO sites)
- `users` - User profiles with visited lists

---

## 🚀 DEPLOYMENT

Current hosting URL: `https://travel-list-4e4f4.web.app`

To deploy changes:
```bash
npm run build
npx firebase deploy --only hosting
```

---

**Next Session Goals:**
1. Find and integrate better country dataset
2. Re-seed database with clean data
3. Test all functionality end-to-end
