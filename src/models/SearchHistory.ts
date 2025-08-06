import mongoose, { Document, Schema } from 'mongoose';

export interface ISearchHistory extends Document {
  location: string;
  preferences: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  searchQuery: string;
  resultsCount: number;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
}

const SearchHistorySchema = new Schema<ISearchHistory>(
  {
    location: {
      type: String,
      required: true,
      trim: true,
    },
    preferences: {
      type: String,
      default: '',
      trim: true,
    },
    coordinates: {
      lat: {
        type: Number,
      },
      lng: {
        type: Number,
      },
    },
    searchQuery: {
      type: String,
      required: true,
      trim: true,
    },
    resultsCount: {
      type: Number,
      required: true,
      min: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for better query performance
SearchHistorySchema.index({ location: 1, timestamp: -1 });
SearchHistorySchema.index({ preferences: 1, timestamp: -1 });
SearchHistorySchema.index({ timestamp: -1 });

export default mongoose.models.SearchHistory || mongoose.model<ISearchHistory>('SearchHistory', SearchHistorySchema);
