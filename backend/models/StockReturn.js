const mongoose = require('mongoose');

const stockReturnSchema = new mongoose.Schema(
  {
    returnId: { type: String, unique: true, sparse: true }, // Auto-generated return ID
    returnNumber: { type: Number, required: true },
    returnDate: { type: Date, required: true },
    sourceType: { type: String, enum: ['Executive', 'Warehouse'], required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    dcOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'DcOrder' },
    saleId: { type: String },

    // Executive return fields
    executiveId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    executiveName: { type: String },
    customerName: { type: String },
    warehouse: { type: String },
    returnType: { type: String, enum: ['', 'Damaged', 'Expired', 'Excess', 'Wrong item', 'Replacement'] },
    
    // Products from executive return
    products: [{
      product: { type: String, required: true },
      class: { type: String, default: '' },
      level: { type: String, default: '' },
      subject: { type: String, default: '' },
      soldQty: { type: Number, required: true },
      returnQty: { type: Number, required: true }, // Requested return quantity
      unitPrice: { type: Number, default: 0 },
      calculationType: {
        type: String,
        enum: ['normal', 'level_based', 'subject_based', 'none'],
        default: 'normal',
      },
      divisorUsed: { type: Number, default: 1 },
      lineTotal: { type: Number, default: 0 },
      reason: { type: String, required: true },
      remarks: { type: String },
      // Warehouse verification fields
      receivedQty: { type: Number, default: 0 }, // Actual received quantity
      condition: { type: String, enum: ['Sellable', 'Damaged', 'Expired', 'Missing', 'Short received'] },
      batchLot: { type: String },
      storageLocation: { type: String },
      quantityMismatch: { type: Boolean, default: false },
      mismatchRemark: { type: String },
      // Manager decision fields
      managerDecision: { type: String, enum: ['Approve', 'Partial Approve', 'Reject', 'Send Back'] },
      approvedQty: { type: Number, default: 0 },
      stockBucket: { type: String, enum: ['Sellable', 'Damaged', 'Expired', 'QC / Hold'] },
      managerRemark: { type: String },
    }],

    remarks: { type: String, default: '', trim: true },
    executiveRemarks: { type: String },
    lrNumber: { type: String, default: '', trim: true },
    lrDate: { type: Date },
    finYear: { type: String, default: '', trim: true },
    schoolType: { type: String, default: '', trim: true },
    schoolCode: { type: String, default: '', trim: true },
    whReturnRemarks: { type: String, default: '', trim: true },
    transport: { type: String, default: '', trim: true },
    town: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    zone: { type: String, default: '', trim: true },
    cluster: { type: String, default: '', trim: true },
    contactPerson: { type: String, default: '', trim: true },
    contactMobile: { type: String, default: '', trim: true },

    // Evidence photos
    evidencePhotos: [{ type: String }], // Executive uploaded photos
    warehousePhotos: [{ type: String }], // Warehouse verification photos

    // Summary fields
    totalItems: { type: Number, default: 0 },
    totalQuantity: { type: Number, default: 0 }, // Requested total quantity
    totalReceivedQty: { type: Number, default: 0 }, // Total received quantity
    hasMismatch: { type: Boolean, default: false, index: true },
    returnValue: { type: Number, default: 0 },
    approvedReturnValue: { type: Number, default: 0 },
    paymentAdjustmentCreated: { type: Boolean, default: false },
    paymentAdjustmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },

    // Status workflow: Draft -> Submitted -> WAREHOUSE_MANAGER_PENDING -> Approved/Partially Approved/Rejected -> Stock Updated -> Closed
    status: { 
      type: String, 
      enum: ['Draft', 'Submitted', 'Received', 'Pending Manager Approval', 'WAREHOUSE_MANAGER_PENDING', 'Approved', 'Partially Approved', 'Rejected', 'Sent Back', 'Stock Updated', 'Closed'],
      default: 'Submitted',
      index: true
    },
    
    // Warehouse processing
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Warehouse Executive who verified
    verifiedAt: { type: Date },
    submittedToManagerAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Warehouse Manager who approved
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    managerRemarks: { type: String },
    stockUpdatedAt: { type: Date },
    stockUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    vendorReturnMarked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

stockReturnSchema.index({ createdBy: 1, returnNumber: 1 }, { unique: false });
stockReturnSchema.index({ status: 1, sourceType: 1 });
stockReturnSchema.index({ executiveId: 1, status: 1 });

module.exports = mongoose.model('StockReturn', stockReturnSchema);


