const mongoose = require("mongoose");

const importLogSchema = new mongoose.Schema({
  sourceUrl: { 
    type: String, 
    required: true,
    index: true 
  },
  startedAt: { 
    type: Date, 
    required: true,
    index: true 
  },
  finishedAt: { 
    type: Date 
  },
  totalFetched: { 
    type: Number, 
    default: 0 
  },
  totalImported: { 
    type: Number, 
    default: 0 
  },
  newJobs: { 
    type: Number, 
    default: 0 
  },
  updatedJobs: { 
    type: Number, 
    default: 0 
  },
  failedJobsCount: { 
    type: Number, 
    default: 0 
  },
  failedJobs: [{
    externalJobId: String,
    reason: String,
    timestamp: { type: Date, default: Date.now }
  }],
  error: String,
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

importLogSchema.index({ startedAt: -1, sourceUrl: 1 });

importLogSchema.virtual('total').get(function() {
  return this.totalImported + this.failedJobsCount;
});

importLogSchema.set('toJSON', { virtuals: true });
importLogSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("ImportLog", importLogSchema);