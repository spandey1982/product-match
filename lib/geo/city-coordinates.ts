/**
 * Static city → coordinate table backing /shop's location-radius filter.
 * There's no geocoding provider wired into this app — retailers pick their
 * store city from this same fixed list in Settings, and distance is measured
 * from a shopper's real position (browser geolocation) to the city's center
 * point. City-grained, not street-level; see StoreCity type for the id shape
 * used everywhere else (User.storeCity, the /shop filter, etc).
 */
export interface CityCoordinate {
  city: string;
  state: string;
  lat: number;
  lng: number;
}

export const CITY_COORDINATES: CityCoordinate[] = [
  { city: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777 },
  { city: "Delhi", state: "Delhi", lat: 28.7041, lng: 77.1025 },
  { city: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { city: "Hyderabad", state: "Telangana", lat: 17.385, lng: 78.4867 },
  { city: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
  { city: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
  { city: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
  { city: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },
  { city: "Surat", state: "Gujarat", lat: 21.1702, lng: 72.8311 },
  { city: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
  { city: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
  { city: "Kanpur", state: "Uttar Pradesh", lat: 26.4499, lng: 80.3319 },
  { city: "Nagpur", state: "Maharashtra", lat: 21.1458, lng: 79.0882 },
  { city: "Indore", state: "Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
  { city: "Bhopal", state: "Madhya Pradesh", lat: 23.2599, lng: 77.4126 },
  { city: "Visakhapatnam", state: "Andhra Pradesh", lat: 17.6868, lng: 83.2185 },
  { city: "Vijayawada", state: "Andhra Pradesh", lat: 16.5062, lng: 80.648 },
  { city: "Patna", state: "Bihar", lat: 25.5941, lng: 85.1376 },
  { city: "Vadodara", state: "Gujarat", lat: 22.3072, lng: 73.1812 },
  { city: "Ghaziabad", state: "Uttar Pradesh", lat: 28.6692, lng: 77.4538 },
  { city: "Ludhiana", state: "Punjab", lat: 30.901, lng: 75.8573 },
  { city: "Agra", state: "Uttar Pradesh", lat: 27.1767, lng: 78.0081 },
  { city: "Nashik", state: "Maharashtra", lat: 19.9975, lng: 73.7898 },
  { city: "Faridabad", state: "Haryana", lat: 28.4089, lng: 77.3178 },
  { city: "Meerut", state: "Uttar Pradesh", lat: 28.9845, lng: 77.7064 },
  { city: "Rajkot", state: "Gujarat", lat: 22.3039, lng: 70.8022 },
  { city: "Varanasi", state: "Uttar Pradesh", lat: 25.3176, lng: 82.9739 },
  { city: "Srinagar", state: "Jammu and Kashmir", lat: 34.0837, lng: 74.7973 },
  { city: "Amritsar", state: "Punjab", lat: 31.634, lng: 74.8723 },
  { city: "Coimbatore", state: "Tamil Nadu", lat: 11.0168, lng: 76.9558 },
  { city: "Madurai", state: "Tamil Nadu", lat: 9.9252, lng: 78.1198 },
  { city: "Kochi", state: "Kerala", lat: 9.9312, lng: 76.2673 },
  { city: "Thiruvananthapuram", state: "Kerala", lat: 8.5241, lng: 76.9366 },
  { city: "Chandigarh", state: "Chandigarh", lat: 30.7333, lng: 76.7794 },
  { city: "Guwahati", state: "Assam", lat: 26.1445, lng: 91.7362 },
  { city: "Bhubaneswar", state: "Odisha", lat: 20.2961, lng: 85.8245 },
  { city: "Dehradun", state: "Uttarakhand", lat: 30.3165, lng: 78.0322 },
  { city: "Raipur", state: "Chhattisgarh", lat: 21.2514, lng: 81.6296 },
  { city: "Ranchi", state: "Jharkhand", lat: 23.3441, lng: 85.3096 },
  { city: "Jodhpur", state: "Rajasthan", lat: 26.2389, lng: 73.0243 },
  { city: "Udaipur", state: "Rajasthan", lat: 24.5854, lng: 73.7125 },
  { city: "Noida", state: "Uttar Pradesh", lat: 28.5355, lng: 77.391 },
  { city: "Gurugram", state: "Haryana", lat: 28.4595, lng: 77.0266 },
  { city: "Mysuru", state: "Karnataka", lat: 12.2958, lng: 76.6394 },
  { city: "Mangaluru", state: "Karnataka", lat: 12.9141, lng: 74.856 },
  { city: "Nagercoil", state: "Tamil Nadu", lat: 8.1833, lng: 77.4119 },
];

export function findCityCoordinate(city: string | null | undefined): CityCoordinate | null {
  if (!city) return null;
  const normalized = city.trim().toLowerCase();
  return CITY_COORDINATES.find((c) => c.city.toLowerCase() === normalized) ?? null;
}

export const CITY_NAMES = CITY_COORDINATES.map((c) => c.city);
