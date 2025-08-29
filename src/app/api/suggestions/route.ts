import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import SearchHistory from '@/models/SearchHistory';
import PopularKeyword from '@/models/PopularKeyword';

interface Suggestion {
  _id?: string;
  location?: string;
  preferences?: string;
  keyword?: string;
  category?: string;
  count: number;
  lastUsed: Date;
  type: 'location' | 'keyword' | 'preferences';
}

export async function GET(request: NextRequest) {
  try {
    // During build time, return empty suggestions if no valid DB connection
    if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('dummy') || process.env.MONGODB_URI.includes('localhost')) {
      return NextResponse.json({
        suggestions: [],
        message: 'Database not available during build'
      });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const limit = parseInt(searchParams.get('limit') || '10');

    let suggestions: Suggestion[] = [];

    if (type === 'locations' || type === 'all') {
      // Get popular locations from search history
      const popularLocations = await SearchHistory.aggregate([
        {
          $group: {
            _id: '$location',
            count: { $sum: 1 },
            lastUsed: { $max: '$timestamp' }
          }
        },
        {
          $sort: { count: -1, lastUsed: -1 }
        },
        {
          $limit: limit
        },
        {
          $project: {
            location: '$_id',
            count: 1,
            lastUsed: 1,
            type: { $literal: 'location' }
          }
        }
      ]);

      suggestions = [...suggestions, ...popularLocations];
    }

    if (type === 'keywords' || type === 'all') {
      // Get popular keywords
      const popularKeywords = await PopularKeyword.find()
        .sort({ count: -1, lastUsed: -1 })
        .limit(limit)
        .select('keyword category count lastUsed')
        .lean();

      const keywordSuggestions: Suggestion[] = popularKeywords.map(keyword => ({
        keyword: keyword.keyword,
        category: keyword.category,
        count: keyword.count,
        lastUsed: keyword.lastUsed,
        type: 'keyword' as const
      }));

      suggestions = [...suggestions, ...keywordSuggestions];
    }

    if (type === 'preferences' || type === 'all') {
      // Get popular preferences from search history
      const popularPreferences = await SearchHistory.aggregate([
        {
          $match: { preferences: { $ne: '' } }
        },
        {
          $group: {
            _id: '$preferences',
            count: { $sum: 1 },
            lastUsed: { $max: '$timestamp' }
          }
        },
        {
          $sort: { count: -1, lastUsed: -1 }
        },
        {
          $limit: limit
        },
        {
          $project: {
            preferences: '$_id',
            count: 1,
            lastUsed: 1,
            type: { $literal: 'preferences' }
          }
        }
      ]);

      suggestions = [...suggestions, ...popularPreferences];
    }

    // Sort all suggestions by count and limit
    suggestions.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    });

    return NextResponse.json({
      suggestions: suggestions.slice(0, limit),
      total: suggestions.length
    });

  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // During build time, return empty stats if no valid DB connection
    if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('dummy') || process.env.MONGODB_URI.includes('localhost')) {
      return NextResponse.json({
        totalSearches: 0,
        popularKeywords: [],
        topLocations: [],
        message: 'Database not available during build'
      });
    }

    await dbConnect();

    const { timeRange = '7d' } = await request.json();

    const dateFilter = new Date();
    
    switch (timeRange) {
      case '1d':
        dateFilter.setDate(dateFilter.getDate() - 1);
        break;
      case '7d':
        dateFilter.setDate(dateFilter.getDate() - 7);
        break;
      case '30d':
        dateFilter.setDate(dateFilter.getDate() - 30);
        break;
      case '90d':
        dateFilter.setDate(dateFilter.getDate() - 90);
        break;
      default:
        dateFilter.setDate(dateFilter.getDate() - 7);
    }

    const stats = await SearchHistory.aggregate([
      {
        $match: {
          timestamp: { $gte: dateFilter }
        }
      },
      {
        $group: {
          _id: null,
          totalSearches: { $sum: 1 },
          avgResultsCount: { $avg: '$resultsCount' },
          uniqueLocations: { $addToSet: '$location' },
          uniquePreferences: { $addToSet: '$preferences' }
        }
      },
      {
        $project: {
          totalSearches: 1,
          avgResultsCount: { $round: ['$avgResultsCount', 2] },
          uniqueLocationsCount: { $size: '$uniqueLocations' },
          uniquePreferencesCount: { $size: '$uniquePreferences' }
        }
      }
    ]);

    const topLocations = await SearchHistory.aggregate([
      {
        $match: {
          timestamp: { $gte: dateFilter }
        }
      },
      {
        $group: {
          _id: '$location',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    const topPreferences = await SearchHistory.aggregate([
      {
        $match: {
          timestamp: { $gte: dateFilter },
          preferences: { $ne: '' }
        }
      },
      {
        $group: {
          _id: '$preferences',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    return NextResponse.json({
      stats: stats[0] || {
        totalSearches: 0,
        avgResultsCount: 0,
        uniqueLocationsCount: 0,
        uniquePreferencesCount: 0
      },
      topLocations,
      topPreferences,
      timeRange
    });

  } catch (error) {
    console.error('Error fetching search statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search statistics' },
      { status: 500 }
    );
  }
}
