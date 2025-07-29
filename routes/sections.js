import express from 'express';
const router = express.Router();

// Basic sections routes
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Sections endpoint available',
    data: []
  });
});

router.post('/', (req, res) => {
  res.json({
    success: true,
    message: 'Section created successfully',
    data: req.body
  });
});

router.get('/:id', (req, res) => {
  res.json({
    success: true,
    message: 'Section retrieved successfully',
    data: { id: req.params.id }
  });
});

router.put('/:id', (req, res) => {
  res.json({
    success: true,
    message: 'Section updated successfully',
    data: { id: req.params.id, ...req.body }
  });
});

router.delete('/:id', (req, res) => {
  res.json({
    success: true,
    message: 'Section deleted successfully',
    data: { id: req.params.id }
  });
});

export default router; 