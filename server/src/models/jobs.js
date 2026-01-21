const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  source: { 
    type: String, 
    required: true,
    index: true 
  },
  externalJobId: { 
    type: String, 
    required: true,
    index: true 
  },
  title: { 
    type: String,
    required: true 
  },
  company: String,
  location: String,
  description: String,
  url: String,
  category: String,
  jobType: String,
  region: String,
  postedDate: Date,
  rawPayload: {
    type: mongoose.Schema.Types.Mixed
  },
  importedAt: {
    type: Date,
    default: Date.now
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true 
});

jobSchema.index({ source: 1, externalJobId: 1 }, { unique: true });

jobSchema.index({ company: 1 });
jobSchema.index({ location: 1 });
jobSchema.index({ category: 1 });
jobSchema.index({ createdAt: -1 });

jobSchema.pre('findOneAndUpdate', function() {
  this.set({ lastUpdatedAt: new Date() });
});

module.exports = mongoose.model("Job", jobSchema);