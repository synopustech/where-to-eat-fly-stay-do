# 🍽️✈️ Where to Eat, Fly, Stay & Do - AI-Powered Travel Platform

A modern web application that helps users find restaurants and plan flights with AI-powered recommendations, integrating Claude AI, Google Places API, and Expedia affiliate links.

## 🎯 Features

### 🍽️ Restaurant Finder
- **Intelligent Restaurant Search**: Powered by Claude AI for personalized recommendations
- **Google Maps Integration**: Real restaurant data with locations, ratings, and reviews
- **Smart Filtering**: Advanced search with cuisine, dietary restrictions, and preferences
- **AI-Powered Insights**: Claude analyzes restaurant reviews and provides detailed insights
- **Real-time Information**: Current ratings, hours, contact info, and availability

### ✈️ Flight Search
- **Smart Flight Search**: AI-powered flight affiliate link generation
- **Airport Autocomplete**: Intelligent airport and city suggestions with CSV database
- **Dynamic Passenger Forms**: Flexible passenger and age input handling
- **Expedia Integration**: Direct affiliate links with optimized parameters
- **Multi-Airport Support**: City-wide search for locations with multiple airports

### 🎨 Design & UX
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **Modern UI**: Clean, intuitive interface with Bootstrap 5 and Pantone color styling
- **Location-Biased Search**: Prioritizes nearby suggestions based on user location
- **Consistent Experience**: Unified design language across all features

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 or later)
- **Claude AI API Key** from [Anthropic Console](https://console.anthropic.com/)
- **Google Places API Key** from [Google Cloud Console](https://console.cloud.google.com/)
- **Expedia Affiliate Account** for flight monetization

### Local Development Setup

1. **Clone and install**:
   ```bash
   git clone <your-repo-url>
   cd where-to
   npm install
   ```

2. **Configure environment variables**:
   Create `.env.local` file:
   ```env
   # Claude AI
   CLAUDE_API_KEY=your_claude_api_key_here
   
   # Google Maps & Places
   GOOGLE_MAPS_API_KEY=your_google_places_api_key_here
   NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
   
   # Expedia Affiliate
   EXPEDIA_AFFCID=your_expedia_affiliate_id
   EXPEDIA_MY_AD=your_expedia_ad_tracking_id
   
   # MongoDB (Optional - for analytics)
   MONGODB_URI=your_mongodb_connection_string
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** to [http://localhost:3000](http://localhost:3000)

## � Technology Stack

### Frontend
- **Next.js 15.4.5** - React framework with App Router
- **React 19.1.0** - UI library with latest features
- **TypeScript** - Type safety and enhanced development experience
- **Bootstrap 5** - Responsive UI components with custom Pantone theming
- **Google Maps JavaScript API** - Location autocomplete and mapping

### Backend & APIs
- **Next.js API Routes** - Serverless API endpoints
- **Google Places API (New v1)** - Restaurant data and search
- **Claude AI (Anthropic)** - Intelligent recommendations and analysis
- **Expedia Affiliate API** - Flight search and booking links

### Data & Storage
- **CSV Airport Database** - 8,142 airports with intelligent city grouping
- **MongoDB** (Optional) - Search analytics and popular keywords
- **Environment Variables** - Secure configuration management

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Restaurant finder homepage
│   ├── flight-search/
│   │   └── page.tsx               # Flight search interface
│   ├── components/
│   │   ├── RestaurantCard.tsx     # Restaurant display component
│   │   ├── SearchForm.tsx         # Location search with autocomplete
│   │   └── GoogleMapsScript.tsx   # Google Maps API loader
│   └── api/
│       ├── restaurants/
│       │   └── search/route.ts    # Restaurant search endpoint
│       ├── flights/
│       │   └── generate/route.ts  # Flight URL generation
│       └── airports/route.ts      # Airport autocomplete API
├── lib/
│   ├── expedia-affiliate.ts       # Flight affiliate URL generation
│   ├── airports.ts               # Airport search logic
│   ├── google-maps-client.ts     # Google Maps client
│   └── mongodb.ts               # Database connection
├── models/
│   ├── SearchHistory.ts          # Search analytics model
│   └── PopularKeyword.ts         # Popular search terms
└── types/
    └── google-maps.d.ts          # TypeScript definitions

data/
└── airports.csv                  # Global airport database

public/
├── *.svg                         # UI icons and graphics
```

## 🔄 Deployment

This project is optimized for **Vercel** deployment with Next.js.

### Environment Variables Required
Configure these in your Vercel dashboard:

```env
CLAUDE_API_KEY
GOOGLE_MAPS_API_KEY  
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
EXPEDIA_AFFCID
EXPEDIA_MY_AD
MONGODB_URI (optional)
```

## 🎨 Design System

- **Color Palette**: Custom Pantone-inspired colors (Light Cream, Harvest Gold, Jet Black, Charcoal Gray)
- **Typography**: Bootstrap typography with custom font weights
- **Components**: Reusable UI components with consistent styling
- **Responsive**: Mobile-first design with breakpoint optimization

## � API Endpoints

### Restaurant Search
- `POST /api/restaurants/search` - Search restaurants with AI analysis
- Parameters: location, preferences, coordinates, radius

### Flight Search  
- `POST /api/flights/generate` - Generate Expedia affiliate URLs
- Parameters: airports, dates, passengers, class

### Airport Autocomplete
- `GET /api/airports?search={query}` - Airport/city suggestions
- Returns: Intelligent airport and city groupings

## 🚀 Features in Development

- **Hotel Search**: Accommodation finder with booking integration
- **Activity Recommendations**: Local attractions and experiences
- **Trip Planning**: Multi-destination itinerary builder
- **User Accounts**: Save preferences and trip history

## 🐛 Troubleshooting

### Common Issues

1. **Google Places Autocomplete Not Working**: 
   - Verify `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` is set
   - Check Google Cloud Console for API quotas
   - Ensure Places API is enabled

2. **Restaurant Images Not Loading**: 
   - Confirm Google Places API domains are configured in `next.config.js`
   - Check image URL patterns in network tab

3. **Flight Search Errors**:
   - Verify Expedia affiliate credentials
   - Check airport CSV file is accessible
   - Validate passenger parameters format

4. **Build Errors**:
   - Run `npm install` to update dependencies
   - Check TypeScript errors with `npm run build`
   - Verify environment variables are set

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

**Built with ❤️ for travelers and food enthusiasts**
   ```
   CLAUDE_API_KEY=your_claude_api_key_here
   GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser** to [http://localhost:3000](http://localhost:3000)

## 🎮 How to Use

1. **Enter a location** (e.g., "Melbourne CBD", "Sydney", "New York")
2. **Specify your preferences** (cuisine, dietary restrictions, occasion)
3. **Click "Find Places to Eat"** to get AI-powered recommendations
4. **Browse results** with ratings, hours, contact info, and AI insights
5. **Click "Directions"** to open Google Maps
6. **Use phone/website buttons** to contact restaurants directly

## 🔑 Getting API Keys

### Claude AI API Key
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key to your `.env.local` file

### Google Places API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Places API
   - Places API (New)
   - Geocoding API
4. Create credentials (API Key)
5. Copy the key to your `.env.local` file

## 🛠️ Development Commands

```bash
# Start development server (with Turbopack)
npm run dev

# Start development server without Turbopack
npm run dev-standard

# Start development server with HTTPS for mobile testing
npm run dev-https

# Start development server accessible from local network
npm run dev-mobile

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## 📁 Project Structure

```
src/app/
├── api/restaurants/
│   ├── search/route.ts     # Live API (Claude + Google)
│   ├── demo/route.ts       # Demo data
│   └── health/             # API health checks
├── components/
│   ├── SearchForm.tsx      # Search interface
│   └── RestaurantCard.tsx  # Restaurant display
├── globals.css             # Custom CSS styling
├── layout.tsx              # App layout
└── page.tsx                # Main page component
```

## 🎨 Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Next.js API Routes
- **AI**: Claude AI API (Anthropic)
- **Maps**: Google Places API, Google Maps API
- **Styling**: Custom CSS with Bootstrap 5
- **Icons**: Bootstrap Icons

## 🔧 Customization

### Search Preferences
The app uses a freetext approach where users can describe exactly what they want:
- **Cuisine types**: "Italian", "Thai", "fusion", "authentic Mexican", etc.
- **Dietary needs**: "vegetarian", "vegan", "gluten-free", "halal", etc.
- **Occasions**: "date night", "family dinner", "business lunch", "quick bite"
- **Price range**: "budget-friendly", "fine dining", "mid-range"
- **Atmosphere**: "casual", "romantic", "family-friendly", "trendy"

### Styling
The app uses custom CSS in `src/app/globals.css` with Bootstrap 5. Modify styles directly or extend the existing utility classes.

### AI Prompts
Customize the Claude AI prompts in `src/app/api/restaurants/search/route.ts` to change recommendation logic.

## 🚨 Troubleshooting

### Common Issues

1. **API Key Errors**: Ensure your API keys are correctly set in `.env.local`
2. **No Results**: Check if the location is valid and try different search terms
3. **Build Errors**: Run `npm install` to ensure all dependencies are installed
4. **Location Permission**: Allow location access for better results
5. **Mobile Testing**: Use `npm run dev-mobile` to test on mobile devices

### Debug Mode
The app includes comprehensive error handling and logging for development. Check the browser console for detailed error messages.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🎉 Deployment

Ready for deployment to:
- **Vercel** (recommended for Next.js apps)
- **Netlify**
- **AWS**
- **Any Node.js hosting platform**

## 🧹 Recent Updates

This project has been recently cleaned and optimized:
- ✅ Removed duplicate components and unused files
- ✅ Cleaned up debug console logs for production
- ✅ Streamlined codebase with single source of truth
- ✅ Updated documentation to reflect current state
- ✅ Optimized for better performance and maintainability

---

**Enjoy finding amazing restaurants with AI-powered recommendations!** 🍽️✨
