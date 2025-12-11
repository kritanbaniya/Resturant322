const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const config = require('../config');

// create manager account
async function createManager() {
  try {
    // connect to mongodb
    await mongoose.connect(config.MONGO_URI);
    console.log('Connected to MongoDB');

    // get manager details from command line arguments or use defaults
    const args = process.argv.slice(2);
    const email = args[0] || 'manager@aieats.com';
    const password = args[1] || 'manager123';
    const name = args[2] || 'Manager';

    // check if manager already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`❌ Manager with email ${email} already exists!`);
      process.exit(1);
    }

    // hash password
    const hashed = await bcrypt.hash(password, 10);

    // create manager user
    const manager = new User({
      email,
      password_hash: hashed,
      name,
      role: 'Manager',
      status: 'Active',
      balance: 0,
      totalSpent: 0,
      orderCount: 0,
      isVIP: false,
      warningCount: 0,
      netComplaints: 0,
      demotionsCount: 0
    });

    await manager.save();

    console.log('\n✅ Manager account created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Name:     ${name}`);
    console.log(`Role:     Manager`);
    console.log(`Status:   Active`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nYou can now login at: http://localhost:5000/login.html');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating manager:', error);
    process.exit(1);
  }
}

createManager();
