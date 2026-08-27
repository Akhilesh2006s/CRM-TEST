const StockReturn = require('../models/StockReturn');
const Lead = require('../models/Lead');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const DC = require('../models/DC');
const {
  calculateProductTotal,
  normalizeCalculationType,
  roundToTwo,
} = require('../utils/paymentDivisor');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for stock return photo uploads
const photoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/stock-returns');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'return-photo-' + uniqueSuffix + ext);
  }
});

const photoFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: photoFileFilter
});

async function getNextReturnNumber(userId) {
  const latest = await StockReturn.find({ createdBy: userId }).sort({ returnNumber: -1 }).limit(1);
  const latestNum = latest.length > 0 ? latest[0].returnNumber : 0;
  return latestNum + 1;
}

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function loadProductMetaByName(productNames = []) {
  const unique = Array.from(
    new Set(
      (productNames || [])
        .map((n) => String(n || '').trim())
        .filter(Boolean)
    )
  );
  if (unique.length === 0) return new Map();
  const docs = await Product.find({
    productName: { $in: unique.map((n) => new RegExp(`^${escapeRegex(n)}$`, 'i')) },
  })
    .select('productName calculationType productLevels subjects')
    .lean();
  const map = new Map();
  docs.forEach((d) => {
    map.set(String(d.productName || '').trim().toLowerCase(), d);
  });
  return map;
}

function normalizeReturnRow(input = {}) {
  return {
    product: String(input.product || input.productName || '').trim(),
    class: String(input.class || '').trim(),
    level: String(input.level || '').trim(),
    subject: String(input.subject || '').trim(),
    soldQty: Number(input.soldQty) || 0,
    returnQty: Number(input.returnQty) || 0,
    unitPrice: Number(input.unitPrice) || 0,
    reason: String(input.reason || '').trim(),
    remarks: String(input.remarks || '').trim(),
    receivedQty: Number(input.receivedQty) || 0,
    condition: input.condition || undefined,
    batchLot: String(input.batchLot || '').trim(),
    storageLocation: String(input.storageLocation || '').trim(),
    quantityMismatch: Boolean(input.quantityMismatch),
    mismatchRemark: String(input.mismatchRemark || '').trim(),
    managerDecision: input.managerDecision || undefined,
    approvedQty: Number(input.approvedQty) || 0,
    stockBucket: input.stockBucket || undefined,
    managerRemark: String(input.managerRemark || '').trim(),
  };
}

function groupedRowsForDivisor(rows, productName, className) {
  return rows
    .filter((r) => {
      const pName = String(r.product || '').trim().toLowerCase();
      const pTarget = String(productName || '').trim().toLowerCase();
      if (!pName || pName !== pTarget) return false;
      if (!className) return true;
      return String(r.class || '').trim() === String(className || '').trim();
    })
    .map((r) => ({
      strength: Number(r.returnQty) || 0,
      level: r.level,
      subject: r.subject,
    }));
}

async function applyReturnBilling(rows = []) {
  const normalized = rows.map(normalizeReturnRow);
  const productMeta = await loadProductMetaByName(normalized.map((r) => r.product));

  const computedRows = normalized.map((row) => {
    const meta = productMeta.get(String(row.product || '').toLowerCase()) || null;
    const ct = normalizeCalculationType(meta?.calculationType || row.calculationType || 'normal');
    const divisorRows = groupedRowsForDivisor(normalized, row.product, row.class);
    const fallbackCount =
      ct === 'level_based'
        ? Array.isArray(meta?.productLevels)
          ? meta.productLevels.length
          : 0
        : ct === 'subject_based'
          ? Array.isArray(meta?.subjects)
            ? meta.subjects.length
            : 0
          : 0;
    const bill = calculateProductTotal({
      calculationType: ct,
      unitPrice: row.unitPrice,
      rows: divisorRows,
      catalogFallbackCount: fallbackCount,
    });
    const lineStrength = Number(row.returnQty) || 0;
    const sumStrength = Number(bill.sumStrength) || 0;
    const ratio = sumStrength > 0 ? lineStrength / sumStrength : 0;
    const lineTotal = roundToTwo((Number(bill.total) || 0) * ratio);
    return {
      ...row,
      calculationType: bill.calculationType,
      divisorUsed: Number(bill.divisorUsed) || 1,
      lineTotal,
    };
  });

  const returnValue = roundToTwo(computedRows.reduce((sum, r) => sum + (Number(r.lineTotal) || 0), 0));
  return { products: computedRows, returnValue };
}

function computeApprovedReturnValue(products = []) {
  const total = (products || []).reduce((sum, p) => {
    const approvedQty = Number(p.approvedQty) || 0;
    const requestedQty = Number(p.returnQty) || 0;
    const lineTotal = Number(p.lineTotal) || 0;
    if (approvedQty <= 0 || requestedQty <= 0 || lineTotal <= 0) return sum;
    return sum + lineTotal * Math.min(1, approvedQty / requestedQty);
  }, 0);
  return roundToTwo(total);
}

async function createCreditNoteForReturn(returnDoc) {
  if (!returnDoc || returnDoc.paymentAdjustmentCreated) return null;
  const approvedValue = Number(returnDoc.approvedReturnValue) || 0;
  if (approvedValue <= 0) return null;

  const dcOrderId = typeof returnDoc.dcOrderId === 'object' ? returnDoc.dcOrderId?._id : returnDoc.dcOrderId;
  let linkedDcId = null;
  if (dcOrderId) {
    const linkedDc = await DC.findOne({ dcOrderId }).select('_id').sort({ createdAt: -1 }).lean();
    linkedDcId = linkedDc?._id || null;
  }

  const filter = {
    status: 'Approved',
    adjustmentType: { $ne: 'credit_note' },
  };
  if (linkedDcId) {
    filter.dcId = linkedDcId;
  } else if (returnDoc.customerName) {
    filter.customerName = returnDoc.customerName;
  }

  const basePayment = await Payment.findOne(filter).sort({ paymentDate: 1, createdAt: 1 });
  const creditNote = await Payment.create({
    customerName: returnDoc.customerName || 'Unknown',
    amount: -Math.abs(approvedValue),
    paymentMethod: 'Other',
    paymentDate: new Date(),
    status: 'Approved',
    description: `Credit note for stock return ${returnDoc.returnId}`,
    schoolCode: basePayment?.schoolCode || '',
    contactName: basePayment?.contactName || '',
    mobileNumber: basePayment?.mobileNumber || '',
    location: basePayment?.location || '',
    zone: basePayment?.zone || '',
    financialYear: basePayment?.financialYear || '',
    dcId: basePayment?.dcId || undefined,
    saleId: basePayment?.saleId || undefined,
    programId: basePayment?.programId || undefined,
    autoCreated: true,
    adjustmentType: 'credit_note',
    adjustmentForPaymentId: basePayment?._id,
    adjustmentReason: `Return approved (${returnDoc.returnId})`,
    approvedBy: returnDoc.approvedBy || undefined,
    approvedAt: new Date(),
    createdBy: returnDoc.approvedBy || returnDoc.createdBy,
  });

  returnDoc.paymentAdjustmentCreated = true;
  returnDoc.paymentAdjustmentId = creditNote._id;
  await returnDoc.save();
  return creditNote;
}

// Executive create (supports Draft: optional returnId, optional products)
const createExecutiveReturn = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const {
      returnId,
      leadId,
      dcOrderId,
      saleId,
      returnDate,
      returnType,
      customerName,
      warehouse,
      remarks,
      executiveRemarks,
      lrNumber,
      lrDate,
      finYear,
      schoolType,
      schoolCode,
      transport,
      town,
      address,
      zone,
      cluster,
      contactPerson,
      contactMobile,
      products,
      evidencePhotos,
      totalItems,
      totalQuantity,
      status,
    } = req.body;

    const isDraft = status === 'Draft';
    if (!returnDate) return res.status(400).json({ message: 'returnDate is required' });

    const incomingProducts = Array.isArray(products) ? products : [];
    // Only products with Return Qty > 0 are returned; ignore 0 / empty qty rows.
    const returningProducts = incomingProducts.filter((p) => Number(p.returnQty) > 0);

    if (!isDraft) {
      if (!lrNumber || !String(lrNumber).trim()) {
        return res.status(400).json({ message: 'LR No is required to submit' });
      }
      if (!lrDate || !String(lrDate).trim()) {
        return res.status(400).json({ message: 'LR Date is required to submit' });
      }
      if (!finYear || !String(finYear).trim()) {
        return res.status(400).json({ message: 'Fin Year is required to submit' });
      }
      if (returningProducts.length === 0) {
        return res.status(400).json({
          message: 'Please enter a return quantity for at least one product.',
        });
      }
      for (const product of returningProducts) {
        const name = String(product.product || '').trim();
        const soldQty = Number(product.soldQty);
        const returnQty = Number(product.returnQty);
        if (!name) {
          return res.status(400).json({ message: 'Product name is required for returned products' });
        }
        if (!Number.isFinite(soldQty) || soldQty < 0) {
          return res.status(400).json({ message: `Valid soldQty is required for ${name}` });
        }
        if (!Number.isFinite(returnQty) || returnQty <= 0) {
          return res.status(400).json({ message: `Return quantity must be greater than 0 for ${name}` });
        }
        if (returnQty > soldQty) {
          return res.status(400).json({ message: `Return Qty cannot exceed Sold Qty for ${name}` });
        }
        if (!product.reason || String(product.reason).trim() === '') {
          return res.status(400).json({ message: `Reason is required for ${name}` });
        }
      }
    }

    const returnNumber = await getNextReturnNumber(req.user._id);
    const generatedReturnId = returnId || `RET-${req.user._id}-${returnNumber}-${Date.now()}`;

    // Persist only lines being returned (or all for draft if none selected yet).
    const productList = isDraft
      ? (returningProducts.length > 0 ? returningProducts : incomingProducts)
      : returningProducts;
    const billed = await applyReturnBilling(productList);
    const doc = await StockReturn.create({
      returnId: generatedReturnId,
      returnNumber,
      returnDate: new Date(returnDate),
      sourceType: 'Executive',
      createdBy: req.user._id,
      executiveId: req.user._id,
      executiveName: req.user.name || 'Unknown',
      leadId: leadId || undefined,
      dcOrderId: dcOrderId || undefined,
      saleId: saleId != null ? String(saleId) : undefined,
      customerName: customerName || '',
      warehouse: warehouse || '',
      returnType: returnType || '',
      remarks: remarks || '',
      executiveRemarks: executiveRemarks || '',
      lrNumber: lrNumber || '',
      lrDate: lrDate ? new Date(lrDate) : undefined,
      finYear: finYear || '',
      schoolType: schoolType || '',
      schoolCode: schoolCode || '',
      transport: transport || '',
      town: town || '',
      address: address || '',
      zone: zone || '',
      cluster: cluster || '',
      contactPerson: contactPerson || '',
      contactMobile: contactMobile || '',
      products: billed.products.map(p => ({
        product: p.product || '',
        class: p.class || '',
        level: p.level || '',
        subject: p.subject || '',
        soldQty: Number(p.soldQty) || 0,
        returnQty: Number(p.returnQty) || 0,
        unitPrice: Number(p.unitPrice) || 0,
        calculationType: p.calculationType || 'normal',
        divisorUsed: Number(p.divisorUsed) || 1,
        lineTotal: Number(p.lineTotal) || 0,
        reason: p.reason || '',
        remarks: p.remarks || '',
      })),
      evidencePhotos: evidencePhotos || [],
      totalItems: totalItems != null ? totalItems : billed.products.length,
      totalQuantity:
        totalQuantity != null
          ? totalQuantity
          : billed.products.reduce((sum, p) => sum + (Number(p.returnQty) || 0), 0),
      returnValue: billed.returnValue,
      status: isDraft ? 'Draft' : (status || 'Submitted'),
    });

    const populated = await StockReturn.findById(doc._id)
      .populate('createdBy', 'name email')
      .populate('executiveId', 'name email')
      .populate('leadId', 'school_name contact_person location')
      .populate('dcOrderId', 'dc_code school_name');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error creating executive return:', error);
    res.status(500).json({
      message: error.message || 'Failed to create return',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// Executive update (only when status is Draft). Can also submit draft via status: 'Submitted'.
const updateExecutiveReturn = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const doc = await StockReturn.findOne({ _id: req.params.id, sourceType: 'Executive', createdBy: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: 'Return not found or you can only edit your own returns' });
    }
    if (doc.status !== 'Draft') {
      return res.status(400).json({ message: 'Only draft returns can be edited' });
    }

    const {
      returnDate,
      returnType,
      customerName,
      warehouse,
      saleId,
      remarks,
      executiveRemarks,
      products,
      evidencePhotos,
      totalItems,
      totalQuantity,
      status: newStatus,
    } = req.body;

    const isSubmit = newStatus === 'Submitted';
    if (isSubmit) {
      const toValidate =
        Array.isArray(req.body.products) && req.body.products.length > 0
          ? req.body.products
          : doc.products;
      const returningProducts = (toValidate || []).filter((p) => Number(p.returnQty) > 0);
      if (returningProducts.length === 0) {
        return res.status(400).json({
          message: 'Please enter a return quantity for at least one product.',
        });
      }
      for (const p of returningProducts) {
        const product = p.product || p.productName;
        const name = String(product || '').trim();
        const soldQty = Number(p.soldQty);
        const returnQty = Number(p.returnQty);
        if (!name) {
          return res.status(400).json({ message: 'Product name is required for returned products' });
        }
        if (!Number.isFinite(returnQty) || returnQty <= 0) {
          return res.status(400).json({ message: `Return quantity must be greater than 0 for ${name}` });
        }
        if (returnQty > soldQty) {
          return res.status(400).json({ message: `Return Qty cannot exceed Sold Qty for ${name}` });
        }
        if (!p.reason || String(p.reason).trim() === '') {
          return res.status(400).json({ message: `Reason is required for ${name}` });
        }
      }
    }

    if (returnDate != null) doc.returnDate = new Date(returnDate);
    if (returnType != null) doc.returnType = returnType;
    if (customerName != null) doc.customerName = customerName;
    if (warehouse != null) doc.warehouse = warehouse;
    if (saleId != null) doc.saleId = String(saleId);
    if (remarks != null) doc.remarks = remarks;
    if (executiveRemarks != null) doc.executiveRemarks = executiveRemarks;
    if (evidencePhotos && Array.isArray(evidencePhotos)) doc.evidencePhotos = evidencePhotos;
    if (products && Array.isArray(products)) {
      const productsToPersist = isSubmit
        ? products.filter((p) => Number(p.returnQty) > 0)
        : products;
      const billed = await applyReturnBilling(productsToPersist);
      doc.products = billed.products.map((p) => ({
        product: p.product || p.productName || '',
        class: p.class || '',
        level: p.level || '',
        subject: p.subject || '',
        soldQty: Number(p.soldQty) || 0,
        returnQty: Number(p.returnQty) || 0,
        unitPrice: Number(p.unitPrice) || 0,
        calculationType: p.calculationType || 'normal',
        divisorUsed: Number(p.divisorUsed) || 1,
        lineTotal: Number(p.lineTotal) || 0,
        reason: p.reason || '',
        remarks: p.remarks || '',
      }));
      doc.totalItems = totalItems != null ? totalItems : doc.products.length;
      doc.totalQuantity = totalQuantity != null ? totalQuantity : doc.products.reduce((sum, p) => sum + (Number(p.returnQty) || 0), 0);
      doc.returnValue = billed.returnValue;
    }
    if (isSubmit) doc.status = 'Submitted';

    await doc.save();

    const populated = await StockReturn.findById(doc._id)
      .populate('createdBy', 'name email')
      .populate('executiveId', 'name email')
      .populate('leadId', 'school_name contact_person location')
      .populate('dcOrderId', 'dc_code school_name');

    res.json(populated);
  } catch (error) {
    console.error('Error updating executive return:', error);
    res.status(500).json({ message: error.message || 'Failed to update return' });
  }
};

// Get single return by id (for view/edit) - executive sees only their own
const getExecutiveReturnById = async (req, res) => {
  try {
    const doc = await StockReturn.findOne({
      _id: req.params.id,
      sourceType: 'Executive',
      createdBy: req.user._id,
    })
      .populate('createdBy', 'name email')
      .populate('executiveId', 'name email')
      .populate('leadId', 'school_name contact_person location')
      .populate('dcOrderId', 'dc_code school_name');
    if (!doc) return res.status(404).json({ message: 'Return not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const warehouseExecutivePopulate = [
  { path: 'createdBy', select: 'name email' },
  { path: 'executiveId', select: 'name email' },
  { path: 'leadId', select: 'school_name contact_person contact_mobile location zone' },
  {
    path: 'dcOrderId',
    select:
      'dc_code school_name school_code contact_person contact_mobile address zone location city area cluster_code transport_name transport_location transportation_landmark',
  },
];

// Warehouse Executive dashboard — full return stock list (all statuses)
const listWarehouseExecutiveList = async (req, res) => {
  try {
    const filter = { sourceType: 'Executive' };
    if (req.query.status) filter.status = req.query.status;
    const items = await StockReturn.find(filter)
      .populate(warehouseExecutivePopulate)
      .sort({ returnDate: -1, createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Warehouse Executive: queue of returns to verify (Submitted or Sent Back for re-verification)
const listWarehouseExecutiveQueue = async (req, res) => {
  try {
    const items = await StockReturn.find({
      sourceType: 'Executive',
      status: { $in: ['Submitted', 'Sent Back'] },
    })
      .populate(warehouseExecutivePopulate)
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Warehouse Executive: get one return for view/verify (Submitted, Sent Back, Received, Pending Manager Approval)
const getReturnForWarehouseExecutive = async (req, res) => {
  try {
    const doc = await StockReturn.findOne({
      _id: req.params.id,
      sourceType: 'Executive',
    })
      .populate(warehouseExecutivePopulate)
      .populate('verifiedBy', 'name email');
    if (!doc) return res.status(404).json({ message: 'Return not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Warehouse Manager dashboard — full list (same shape as warehouse executive list)
const listWarehouseManagerList = async (req, res) => {
  try {
    const filter = { sourceType: 'Executive' };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.pending === 'true') {
      filter.status = { $in: ['WAREHOUSE_MANAGER_PENDING', 'Received', 'Pending Manager Approval'] };
    }
    const items = await StockReturn.find(filter)
      .populate(warehouseExecutivePopulate)
      .populate('verifiedBy', 'name email')
      .sort({ returnDate: -1, createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Warehouse Manager: queue of returns to approve (Received or Pending Manager Approval)
const listWarehouseManagerQueue = async (req, res) => {
  try {
    const items = await StockReturn.find({
      sourceType: 'Executive',
      status: { $in: ['WAREHOUSE_MANAGER_PENDING', 'Received', 'Pending Manager Approval'] },
    })
      .populate(warehouseExecutivePopulate)
      .populate('verifiedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Warehouse Manager: get one return for review/decision
const getReturnForWarehouseManager = async (req, res) => {
  try {
    const doc = await StockReturn.findOne({
      _id: req.params.id,
      sourceType: 'Executive',
    })
      .populate(warehouseExecutivePopulate)
      .populate('verifiedBy', 'name email')
      .populate('approvedBy', 'name email');
    if (!doc) return res.status(404).json({ message: 'Return not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

function isStockReturnAdmin(user) {
  const role = (user?.role || '').trim();
  return role === 'Super Admin' || role === 'Admin';
}

// Super Admin / Admin: full return detail (comparison, decisions, rejection reason)
const getReturnForAdmin = async (req, res) => {
  try {
    if (!isStockReturnAdmin(req.user)) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    const doc = await StockReturn.findOne({
      _id: req.params.id,
      sourceType: 'Executive',
    })
      .populate(warehouseExecutivePopulate)
      .populate('verifiedBy', 'name email')
      .populate('approvedBy', 'name email');
    if (!doc) return res.status(404).json({ message: 'Return not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Executive lists - for warehouse executives to see all submitted returns
const listExecutiveReturns = async (req, res) => {
  try {
    const filter = { sourceType: 'Executive' };
    if (req.query.dcOrderId) filter.dcOrderId = req.query.dcOrderId;
    if (req.query.fromDate || req.query.toDate) {
      filter.createdAt = {};
      if (req.query.fromDate) filter.createdAt.$gte = new Date(req.query.fromDate);
      if (req.query.toDate) filter.createdAt.$lte = new Date(String(req.query.toDate) + 'T23:59:59.999Z');
    }
    const items = await StockReturn.find(filter)
      .populate('createdBy', 'name email')
      .populate('executiveId', 'name email')
      .populate('leadId', 'school_name contact_person location')
      .populate('dcOrderId', 'dc_code school_name school_code')
      .populate('verifiedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const listMyExecutiveReturns = async (req, res) => {
  try {
    const filter = { sourceType: 'Executive', createdBy: req.user._id };
    if (req.query.dcOrderId) filter.dcOrderId = req.query.dcOrderId;
    const items = await StockReturn.find(filter)
      .populate('leadId', 'school_name contact_person location')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Warehouse create
const createWarehouseReturn = async (req, res) => {
  try {
    const { returnDate, remarks, lrNumber, finYear, lineItems } = req.body;
    if (!returnDate) return res.status(400).json({ message: 'returnDate is required' });

    const returnNumber = await getNextReturnNumber(req.user._id);
    const doc = await StockReturn.create({
      returnNumber,
      returnDate,
      sourceType: 'Warehouse',
      createdBy: req.user._id,
      remarks: remarks || '',
      lrNumber: lrNumber || '',
      finYear: finYear || '',
      lineItems: Array.isArray(lineItems) ? lineItems : [],
      status: 'Submitted',
    });
    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const listWarehouseReturns = async (req, res) => {
  try {
    // Warehouse-created returns (all statuses) + Executive returns that have completed
    // Warehouse Manager approval (Stock Updated / Approved). Pending executive returns
    // stay on Manager/Executive queues and must not appear here.
    const items = await StockReturn.find({
      $or: [
        { sourceType: 'Warehouse' },
        {
          sourceType: 'Executive',
          status: { $in: ['Stock Updated', 'Approved', 'Partially Approved', 'Closed'] },
        },
      ],
    })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

function mergeWarehouseProductRows(returnDoc, productsPayload = []) {
  return (productsPayload || returnDoc.products).map((p, index) => {
    const existingByIndex = returnDoc.products[index];
    const existing =
      existingByIndex?.product === (p.product || existingByIndex?.product)
        ? existingByIndex
        : returnDoc.products.find((x) => x.product === (p.product || x.product));
    const requested = Number(existing?.returnQty ?? p.returnQty) || 0;
    const received = Number(p.receivedQty ?? p.qty ?? p.quantity) || 0;
    const mismatch = requested > 0 && received !== requested;
    const base = existing ? (existing.toObject ? existing.toObject() : existing) : p;
    return {
      ...base,
      product: p.product || existing?.product || '',
      class: p.class || existing?.class || '',
      level: p.productName || p.level || existing?.level || '',
      subject: p.subject || existing?.subject || '',
      soldQty: Number(existing?.soldQty ?? p.soldQty) || 0,
      returnQty: requested,
      reason: existing?.reason ?? p.reason ?? '',
      remarks: p.remarks || existing?.remarks || '',
      receivedQty: received,
      condition: p.condition || existing?.condition || (received > 0 ? 'Sellable' : ''),
      batchLot: p.batchLot || existing?.batchLot || '',
      storageLocation: p.storageLocation || existing?.storageLocation || '',
      quantityMismatch: mismatch,
      mismatchRemark: mismatch
        ? String(p.mismatchRemark || existing?.mismatchRemark || '').trim()
        : '',
    };
  });
}

// Warehouse Executive — save progress without submitting to manager
const saveWarehouseReturnUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      returnDate,
      lrNumber,
      lrDate,
      remarks,
      whReturnRemarks,
      transport,
      town,
      address,
      zone,
      cluster,
      contactPerson,
      contactMobile,
      schoolCode,
      products,
      warehousePhotos,
    } = req.body;

    const returnDoc = await StockReturn.findById(id);
    if (!returnDoc) return res.status(404).json({ message: 'Return not found' });
    if (returnDoc.sourceType !== 'Executive') {
      return res.status(400).json({ message: 'Not an executive return' });
    }
    if (!['Submitted', 'Sent Back'].includes(returnDoc.status)) {
      return res.status(400).json({ message: 'Only Submitted or Sent Back returns can be updated here' });
    }

    if (returnDate) returnDoc.returnDate = new Date(returnDate);
    if (lrNumber != null) returnDoc.lrNumber = String(lrNumber).trim();
    if (lrDate) returnDoc.lrDate = new Date(lrDate);
    if (remarks != null) returnDoc.remarks = String(remarks).trim();
    if (whReturnRemarks != null) returnDoc.whReturnRemarks = String(whReturnRemarks).trim();
    if (transport != null) returnDoc.transport = String(transport).trim();
    if (town != null) returnDoc.town = String(town).trim();
    if (address != null) returnDoc.address = String(address).trim();
    if (zone != null) returnDoc.zone = String(zone).trim();
    if (cluster != null) returnDoc.cluster = String(cluster).trim();
    if (contactPerson != null) returnDoc.contactPerson = String(contactPerson).trim();
    if (contactMobile != null) returnDoc.contactMobile = String(contactMobile).trim();
    if (schoolCode != null) returnDoc.schoolCode = String(schoolCode).trim();

    if (products && Array.isArray(products)) {
      returnDoc.products = mergeWarehouseProductRows(returnDoc, products);
      returnDoc.totalQuantity = returnDoc.products.reduce(
        (sum, p) => sum + (Number(p.returnQty) || 0),
        0
      );
      returnDoc.totalReceivedQty = returnDoc.products.reduce(
        (sum, p) => sum + (Number(p.receivedQty) || 0),
        0
      );
    }
    if (warehousePhotos && Array.isArray(warehousePhotos)) {
      returnDoc.warehousePhotos = warehousePhotos;
    }

    await returnDoc.save();
    const populated = await StockReturn.findById(returnDoc._id).populate(warehouseExecutivePopulate);
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to save return update' });
  }
};

// Warehouse Executive verification (only when status is Submitted)
const warehouseVerifyReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      products,
      warehousePhotos,
      totalReceivedQty,
      returnDate,
      lrNumber,
      lrDate,
      remarks,
      whReturnRemarks,
      transport,
      town,
      address,
      zone,
      cluster,
      contactPerson,
      contactMobile,
      schoolCode,
    } = req.body;

    const returnDoc = await StockReturn.findById(id);
    if (!returnDoc) {
      return res.status(404).json({ message: 'Return not found' });
    }
    if (returnDoc.sourceType !== 'Executive') {
      return res.status(400).json({ message: 'Not an executive return' });
    }
    if (!['Submitted', 'Sent Back'].includes(returnDoc.status)) {
      return res.status(400).json({ message: 'Return can only be verified when status is Submitted or Sent Back' });
    }

    const lrNo = lrNumber != null ? String(lrNumber).trim() : returnDoc.lrNumber || '';
    if (!lrNo) {
      return res.status(400).json({
        message: 'LR No is required — enter the number from the delivery partner lorry receipt',
      });
    }
    if (!lrDate && !returnDoc.lrDate) {
      return res.status(400).json({ message: 'LR Date is required when submitting to manager' });
    }

    if (returnDate) returnDoc.returnDate = new Date(returnDate);
    if (lrNumber != null) returnDoc.lrNumber = lrNo;
    if (lrDate) returnDoc.lrDate = new Date(lrDate);
    if (remarks != null) returnDoc.remarks = String(remarks).trim();
    if (whReturnRemarks != null) returnDoc.whReturnRemarks = String(whReturnRemarks).trim();
    if (transport != null) returnDoc.transport = String(transport).trim();
    if (town != null) returnDoc.town = String(town).trim();
    if (address != null) returnDoc.address = String(address).trim();
    if (zone != null) returnDoc.zone = String(zone).trim();
    if (cluster != null) returnDoc.cluster = String(cluster).trim();
    if (contactPerson != null) returnDoc.contactPerson = String(contactPerson).trim();
    if (contactMobile != null) returnDoc.contactMobile = String(contactMobile).trim();
    if (schoolCode != null) returnDoc.schoolCode = String(schoolCode).trim();

    const updatedProducts = mergeWarehouseProductRows(returnDoc, products || returnDoc.products);
    for (const p of updatedProducts) {
      if ((Number(p.receivedQty) || 0) > 0 && !p.condition) {
        return res.status(400).json({ message: `Condition is required for ${p.product}` });
      }
    }

    returnDoc.products = updatedProducts;
    returnDoc.warehousePhotos = Array.isArray(warehousePhotos) ? warehousePhotos : (returnDoc.warehousePhotos || []);
    returnDoc.totalReceivedQty = totalReceivedQty != null ? totalReceivedQty : updatedProducts.reduce((sum, p) => sum + (Number(p.receivedQty) || 0), 0);
    returnDoc.verifiedBy = req.user._id;
    returnDoc.verifiedAt = new Date();
    returnDoc.submittedToManagerAt = new Date();

    const hasMismatch = updatedProducts.some((p) => p.quantityMismatch);
    returnDoc.hasMismatch = hasMismatch;
    returnDoc.status = 'WAREHOUSE_MANAGER_PENDING';

    await returnDoc.save();

    const populated = await StockReturn.findById(returnDoc._id)
      .populate(warehouseExecutivePopulate)
      .populate('verifiedBy', 'name email');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Warehouse Manager actions
const managerAction = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      action,
      products,
      managerRemarks,
      rejectionReason,
    } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const returnDoc = await StockReturn.findById(id);
    if (!returnDoc) {
      return res.status(404).json({ message: 'Return not found' });
    }

    // Update product decisions
    if (products && Array.isArray(products)) {
      returnDoc.products = returnDoc.products.map((p) => {
        const decision = products.find(d => d.product === p.product);
        if (decision) {
          return {
            ...p.toObject ? p.toObject() : p,
            managerDecision: decision.managerDecision,
            approvedQty: decision.approvedQty || 0,
            stockBucket: decision.stockBucket || '',
            managerRemark: decision.managerRemark || '',
            mismatchRemark: decision.mismatchRemark || p.mismatchRemark || '',
          };
        }
        return p.toObject ? p.toObject() : p;
      });
    }

    const missingMismatchRemark = returnDoc.products.find(
      (p) => p.quantityMismatch && !(p.mismatchRemark && String(p.mismatchRemark).trim())
    );
    if (missingMismatchRemark) {
      return res.status(400).json({
        message: `Mismatch remark is required for ${missingMismatchRemark.product}`,
      });
    }

    // Update status and process based on action
    let newStatus = returnDoc.status;
    
    if (action === 'approve') {
      const hasAnyApproval = returnDoc.products.some(
        (p) =>
          (p.managerDecision === 'Approve' || p.managerDecision === 'Partial Approve') &&
          Number(p.approvedQty) > 0
      );
      if (!hasAnyApproval) {
        return res.status(400).json({
          message: 'At least one product line must be approved, or use Reject entire return',
        });
      }

      const allApproved = returnDoc.products.every(
        (p) =>
          p.managerDecision === 'Reject' ||
          p.managerDecision === 'Send Back' ||
          (p.managerDecision === 'Approve' && Number(p.approvedQty) > 0)
      );
      const hasPartial = returnDoc.products.some(
        (p) =>
          p.managerDecision === 'Partial Approve' ||
          (p.managerDecision === 'Approve' &&
            Number(p.approvedQty) > 0 &&
            Number(p.approvedQty) < Number(p.receivedQty))
      );

      if (hasPartial) {
        newStatus = 'Partially Approved';
      } else {
        newStatus = 'Approved';
      }
      
      // Update stock for approved products
      const Warehouse = require('../models/Warehouse');
      const StockMovement = require('../models/StockMovement');
      
      for (const product of returnDoc.products) {
        if ((product.managerDecision === 'Approve' || product.managerDecision === 'Partial Approve') && 
            product.approvedQty > 0 && product.stockBucket) {
          try {
            // Find warehouse item by product name (case-insensitive)
            const warehouseItem = await Warehouse.findOne({
              productName: { $regex: new RegExp(`^${product.product}$`, 'i') }
            });
            
            if (warehouseItem) {
              // Update stock based on bucket
              if (product.stockBucket === 'Sellable') {
                warehouseItem.currentStock = (warehouseItem.currentStock || 0) + product.approvedQty;
                warehouseItem.lastRestocked = new Date();
              } else if (product.stockBucket === 'Damaged') {
                // Track damaged stock separately if you have a field for it
                warehouseItem.currentStock = (warehouseItem.currentStock || 0) + product.approvedQty;
                warehouseItem.lastRestocked = new Date();
              } else if (product.stockBucket === 'Expired') {
                // Track expired stock separately if you have a field for it
                warehouseItem.currentStock = (warehouseItem.currentStock || 0) + product.approvedQty;
                warehouseItem.lastRestocked = new Date();
              } else if (product.stockBucket === 'QC / Hold') {
                // QC/Hold items might not be added to sellable stock
                warehouseItem.currentStock = (warehouseItem.currentStock || 0) + product.approvedQty;
                warehouseItem.lastRestocked = new Date();
              }
              
              await warehouseItem.save();
              
              // Record stock movement
              await StockMovement.create({
                productId: warehouseItem._id,
                movementType: 'Return',
                quantity: product.approvedQty,
                reason: `Stock Return ${returnDoc.returnId} - ${product.stockBucket} - ${product.product}`,
                createdBy: req.user._id,
              });
            } else {
              console.warn(`Warehouse item not found for product: ${product.product}`);
            }
          } catch (err) {
            console.error(`Error updating stock for product ${product.product}:`, err);
            // Continue with other products even if one fails
          }
        }
      }
      
      returnDoc.stockUpdatedAt = new Date();
      returnDoc.stockUpdatedBy = req.user._id;
      newStatus = 'Stock Updated';
    } else if (action === 'reject') {
      newStatus = 'Rejected';
      returnDoc.rejectionReason = rejectionReason || managerRemarks;
    } else if (action === 'send_back') {
      newStatus = 'Sent Back';
    } else if (action === 'vendor_return') {
      returnDoc.vendorReturnMarked = true;
      newStatus = 'Approved'; // Can be adjusted based on workflow
    }

    returnDoc.status = newStatus;
    returnDoc.approvedBy = req.user._id;
    returnDoc.approvedAt = new Date();
    returnDoc.managerRemarks = managerRemarks || '';
    returnDoc.approvedReturnValue = computeApprovedReturnValue(returnDoc.products);

    await returnDoc.save();
    if (['Approved', 'Partially Approved', 'Stock Updated', 'Closed'].includes(returnDoc.status)) {
      await createCreditNoteForReturn(returnDoc);
    }

    const populated = await StockReturn.findById(returnDoc._id)
      .populate('createdBy', 'name email')
      .populate('executiveId', 'name email')
      .populate('verifiedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('leadId', 'school_name contact_person location')
      .populate('dcOrderId', 'dc_code school_name');

    res.json(populated);
  } catch (error) {
    console.error('Error processing manager action:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to process manager action',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Warehouse Returns List — final submit for one already-approved/listed return (status → Closed)
const submitWarehouseListedReturn = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const returnDoc = await StockReturn.findById(req.params.id);
    if (!returnDoc) {
      return res.status(404).json({ message: 'Return not found' });
    }

    if (returnDoc.status === 'Closed') {
      return res.status(400).json({ message: 'Return is already submitted' });
    }

    // Executive returns appear on this list only after manager approval / stock update.
    // Warehouse-created returns may still be Submitted and can be closed from this list.
    const executableStatuses =
      returnDoc.sourceType === 'Executive'
        ? ['Stock Updated', 'Approved', 'Partially Approved']
        : ['Submitted', 'Stock Updated', 'Approved', 'Partially Approved'];

    if (!executableStatuses.includes(returnDoc.status)) {
      return res.status(400).json({
        message: `Return cannot be submitted from Warehouse Returns List in status "${returnDoc.status}"`,
      });
    }

    returnDoc.status = 'Closed';
    await returnDoc.save();

    const populated = await StockReturn.findById(returnDoc._id)
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');

    res.json(populated);
  } catch (error) {
    console.error('Error submitting warehouse listed return:', error);
    res.status(500).json({ message: error.message || 'Failed to submit return' });
  }
};

// Upload photo for stock returns
const uploadReturnPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `/uploads/stock-returns/${req.file.filename}`;
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5001}`;
    const fullUrl = `${baseUrl}${fileUrl}`;

    res.json({
      message: 'Photo uploaded successfully',
      photoUrl: fullUrl,
      url: fullUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ message: error.message || 'Failed to upload photo' });
  }
};

module.exports = {
  createExecutiveReturn,
  updateExecutiveReturn,
  getExecutiveReturnById,
  listExecutiveReturns,
  listMyExecutiveReturns,
  listWarehouseExecutiveList,
  listWarehouseExecutiveQueue,
  getReturnForWarehouseExecutive,
  listWarehouseManagerList,
  listWarehouseManagerQueue,
  getReturnForWarehouseManager,
  getReturnForAdmin,
  createWarehouseReturn,
  listWarehouseReturns,
  submitWarehouseListedReturn,
  saveWarehouseReturnUpdate,
  warehouseVerifyReturn,
  managerAction,
  uploadReturnPhoto,
  uploadReturnPhotoMiddleware: uploadPhoto.single('photo'),
};


