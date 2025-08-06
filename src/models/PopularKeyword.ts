import mongoose, { Document, Schema } from 'mongoose';

export interface IPopularKeyword extends Document {
  keyword: string;
  category: 'cuisine' | 'style' | 'dietary' | 'general';
  count: number;
  lastUsed: Date;
}

const PopularKeywordSchema = new Schema<IPopularKeyword>(
  {
    keyword: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    category: {
      type: String,
      enum: ['cuisine', 'style', 'dietary', 'general'],
      required: true,
    },
    count: {
      type: Number,
      default: 1,
      min: 0,
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes (keyword unique index is already created by unique: true)
PopularKeywordSchema.index({ category: 1, count: -1 });
PopularKeywordSchema.index({ count: -1, lastUsed: -1 });

export default mongoose.models.PopularKeyword || mongoose.model<IPopularKeyword>('PopularKeyword', PopularKeywordSchema);
