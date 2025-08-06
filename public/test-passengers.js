// Test passenger string generation
const testParams = {
  tripType: 'roundtrip',
  departureAirport: 'Kingsford Smith International Airport',
  departureCity: 'Sydney, NSW, Australia', 
  departureCode: 'SYD',
  arrivalAirport: 'Ninoy Aquino International Airport',
  arrivalCity: 'Manila, Philippines',
  arrivalCode: 'MNL',
  departureDate: '2025-08-19',
  returnDate: '2025-08-26',
  adults: 2,
  children: 1,
  childrenAges: [16],
  infants: 1,
  infantAges: [0],
  infantInLap: true,
  cabinClass: 'economy'
};

fetch('/api/flights/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testParams)
})
.then(r => r.json())
.then(data => {
  console.log('Generated URL:', data.url);
  
  // Extract and decode the passengers parameter
  const url = new URL(data.url);
  const passengers = url.searchParams.get('passengers');
  console.log('Passengers parameter:', passengers);
  
  // Should be: children:2[16;0],adults:2,infantinlap:Y
})
.catch(console.error);
