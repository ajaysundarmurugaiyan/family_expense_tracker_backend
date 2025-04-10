const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const Family = require('./models/Family');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            throw new Error('No token provided');
        }

        const decoded = jwt.verify(token, 'your-secret-key-2024');
        const family = await Family.findById(decoded.familyId);
        
        if (!family) {
            throw new Error('Family not found');
        }

        req.family = family;
        next();
    } catch (error) {
        console.error('Auth error:', error.message);
        res.status(401).json({ message: 'Authentication failed', error: error.message });
    }
};

// Register new family
app.post('/api/auth/register', async (req, res) => {
    try {
        console.log('Registration request received:', req.body);
        const { name, password } = req.body;

        // Input validation
        if (!name || !password) {
            console.log('Missing required fields:', { name: !!name, password: !!password });
            return res.status(400).json({ 
                message: 'Family name and password are required',
                details: {
                    name: !name ? 'Name is required' : null,
                    password: !password ? 'Password is required' : null
                }
            });
        }

        if (password.length < 6) {
            console.log('Password too short');
            return res.status(400).json({ 
                message: 'Password must be at least 6 characters long' 
            });
        }

        // Check if family already exists
        const existingFamily = await Family.findOne({ name: name });
        if (existingFamily) {
            console.log('Family name already exists:', name);
            return res.status(400).json({ message: 'Family name already exists' });
        }

        // Create new family
        const family = new Family({
            name,
            password,
            members: []
        });

        console.log('Attempting to save family:', { name: family.name });
        
        // Save the family with error handling
        try {
            await family.save();
            console.log('Family saved successfully:', { id: family._id, name: family.name });
        } catch (saveError) {
            console.error('Error saving family:', saveError);
            return res.status(500).json({ 
                message: 'Error saving family',
                error: saveError.message
            });
        }

        // Generate token
        let token;
        try {
            token = jwt.sign(
                { familyId: family._id },
                'your-secret-key-2024',
                { expiresIn: '24h' }
            );
            console.log('Token generated successfully');
        } catch (tokenError) {
            console.error('Error generating token:', tokenError);
            // If token generation fails, remove the saved family
            await Family.findByIdAndDelete(family._id);
            return res.status(500).json({ 
                message: 'Error generating authentication token',
                error: tokenError.message
            });
        }

        res.status(201).json({
            token,
            family: {
                id: family._id,
                name: family.name
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            message: 'Error creating family',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Login family
app.post('/api/auth/login', async (req, res) => {
    try {
        console.log('Login request received:', { name: req.body.name });
        const { name, password } = req.body;

        if (!name || !password) {
            return res.status(400).json({ message: 'Family name and password are required' });
        }

        // Find family
        const family = await Family.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (!family) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Verify password
        const isMatch = await family.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
            { familyId: family._id },
            'your-secret-key-2024',
            { expiresIn: '24h' }
        );

        console.log('Successful login for family:', { id: family._id, name: family.name });

        res.json({
            token,
            family: {
                id: family._id,
                name: family.name
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            message: 'Error during login',
            error: error.message
        });
    }
});

// Get family details
app.get('/api/family/:id', auth, async (req, res) => {
    try {
        const family = await Family.findById(req.params.id);
        if (!family) {
            return res.status(404).json({ message: 'Family not found' });
        }

        res.json({
            id: family._id,
            name: family.name,
            members: family.members,
            totalIncome: family.totalIncome,
            totalExpenses: family.totalExpenses
        });
    } catch (error) {
        console.error('Error fetching family details:', error);
        res.status(500).json({ 
            message: 'Error fetching family details',
            error: error.message
        });
    }
});

// Add family member
app.post('/api/family/:id/members', auth, async (req, res) => {
    try {
        const { name, isEarning, salary } = req.body;
        const family = await Family.findById(req.params.id);

        if (!family) {
            return res.status(404).json({ message: 'Family not found' });
        }

        if (!name) {
            return res.status(400).json({ message: 'Member name is required' });
        }

        family.members.push({
            name,
            isEarning: Boolean(isEarning),
            salary: Number(salary) || 0,
            expenses: [],
            totalSpent: 0
        });

        await family.save();
        console.log('New member added:', { familyId: family._id, memberName: name });

        res.status(201).json(family);
    } catch (error) {
        console.error('Error adding member:', error);
        res.status(500).json({ 
            message: 'Error adding member',
            error: error.message
        });
    }
});

// Update family member
app.put('/api/family/:familyId/members/:memberId', auth, async (req, res) => {
    try {
        const { name, isEarning, salary } = req.body;
        const family = await Family.findById(req.params.familyId);

        if (!family) {
            return res.status(404).json({ message: 'Family not found' });
        }

        const member = family.members.id(req.params.memberId);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        member.name = name;
        member.isEarning = Boolean(isEarning);
        member.salary = Number(salary) || 0;

        await family.save();
        console.log('Member updated:', { familyId: family._id, memberId: member._id });

        res.json(family);
    } catch (error) {
        console.error('Error updating member:', error);
        res.status(500).json({ 
            message: 'Error updating member',
            error: error.message
        });
    }
});

// Delete family member
app.delete('/api/family/:familyId/members/:memberId', auth, async (req, res) => {
    try {
        // Find the family
        const family = await Family.findById(req.params.familyId);
        if (!family) {
            return res.status(404).json({ message: 'Family not found' });
        }

        // Find the member to be deleted
        const member = family.members.id(req.params.memberId);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        // Store the member's data before deletion for logging
        const deletedMemberData = {
            name: member.name,
            isEarning: member.isEarning,
            salary: member.salary,
            totalSpent: member.totalSpent
        };

        // Remove the member from the family array
        family.members = family.members.filter(m => m._id.toString() !== req.params.memberId);

        // Recalculate total income (sum of salaries of remaining members)
        family.totalIncome = family.members.reduce((sum, m) => sum + (m.isEarning ? m.salary : 0), 0);

        // Recalculate total expenses (sum of all expenses from remaining members)
        family.totalExpenses = family.members.reduce((sum, m) => {
            // Calculate total spent for each member
            m.totalSpent = m.expenses.reduce((expSum, exp) => expSum + exp.amount, 0);
            return sum + m.totalSpent;
        }, 0);

        // Save the updated family document
        await family.save();

        console.log('Member deleted:', { 
            familyId: req.params.familyId, 
            memberId: req.params.memberId,
            deletedMember: deletedMemberData,
            newTotalIncome: family.totalIncome,
            newTotalExpenses: family.totalExpenses,
            remainingMembers: family.members.length
        });

        res.json(family);
    } catch (error) {
        console.error('Error deleting member:', error);
        res.status(500).json({ 
            message: 'Error deleting member',
            error: error.message
        });
    }
});

// Add expense for a member
app.post('/api/family/:familyId/members/:memberId/expenses', auth, async (req, res) => {
    try {
        const { description, amount, category } = req.body;
        const family = await Family.findById(req.params.familyId);

        if (!family) {
            return res.status(404).json({ message: 'Family not found' });
        }

        const member = family.members.id(req.params.memberId);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        if (!description || !amount || !category) {
            return res.status(400).json({ message: 'Description, amount, and category are required' });
        }

        member.expenses.push({
            description,
            amount: Number(amount),
            category,
            date: new Date()
        });

        member.totalSpent += Number(amount);
        await family.save();

        console.log('New expense added:', { 
            familyId: family._id, 
            memberId: member._id,
            amount: amount
        });

        res.status(201).json(family);
    } catch (error) {
        console.error('Error adding expense:', error);
        res.status(500).json({ 
            message: 'Error adding expense',
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
}); 
