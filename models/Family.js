const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Expense Schema
const expenseSchema = new mongoose.Schema({
    description: {
        type: String,
        required: [true, 'Expense description is required'],
        trim: true
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['Food', 'Transportation', 'Housing', 'Utilities', 'Healthcare', 'Entertainment', 'Shopping', 'Others']
    },
    date: {
        type: Date,
        default: Date.now
    }
});

// Member Schema
const memberSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Member name is required'],
        trim: true
    },
    isEarning: {
        type: Boolean,
        default: false
    },
    salary: {
        type: Number,
        default: 0,
        min: [0, 'Salary cannot be negative']
    },
    expenses: [expenseSchema],
    totalSpent: {
        type: Number,
        default: 0
    }
});

// Family Schema
const familySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Family name is required'],
        unique: true,
        trim: true,
        minlength: [2, 'Family name must be at least 2 characters long']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    members: [memberSchema],
    totalIncome: {
        type: Number,
        default: 0
    },
    totalExpenses: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Pre-save middleware for password hashing
familySchema.pre('save', async function(next) {
    try {
        if (!this.isModified('password')) {
            return next();
        }
        
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        console.error('Error hashing password:', error);
        next(error);
    }
});

// Compare password method
familySchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        console.error('Error comparing passwords:', error);
        throw new Error('Error comparing passwords');
    }
};

// Calculate totals before saving
familySchema.pre('save', function(next) {
    try {
        // Calculate total income (sum of salaries of earning members)
        this.totalIncome = this.members.reduce((sum, member) => {
            return sum + (member.isEarning ? member.salary : 0);
        }, 0);

        // Calculate total expenses and update member totalSpent
        this.totalExpenses = this.members.reduce((sum, member) => {
            // Calculate total spent for each member
            member.totalSpent = member.expenses.reduce((expSum, exp) => expSum + exp.amount, 0);
            return sum + member.totalSpent;
        }, 0);

        console.log('Totals calculated:', {
            totalIncome: this.totalIncome,
            totalExpenses: this.totalExpenses,
            memberCount: this.members.length
        });

        next();
    } catch (error) {
        console.error('Error calculating totals:', error);
        next(error);
    }
});

// Add error handling for member operations
memberSchema.pre('save', function(next) {
    try {
        if (this.isEarning && this.salary < 0) {
            throw new Error('Salary cannot be negative');
        }
        next();
    } catch (error) {
        next(error);
    }
});

const Family = mongoose.model('Family', familySchema);
module.exports = Family; 
