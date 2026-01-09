const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserMongo = require('../models/User');
const UserMock = require('../mockdb/userDB');
const { validateRegister, validateLogin, checkValidation } = require('../middleware/validationMiddleware');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'college_media_secret_key';

// Register a new user
router.post('/register', validateRegister, checkValidation, async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    
    // Get database connection from app
    const dbConnection = req.app.get('dbConnection');
    
    if (dbConnection && dbConnection.useMongoDB) {
      // Use MongoDB
      const existingUser = await UserMongo.findOne({ 
        $or: [{ email }, { username }] 
      });
      
      if (existingUser) {
        return res.status(400).json({ 
          success: false,
          data: null,
          message: 'User with this email or username already exists' 
        });
      }

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new user
      const newUser = new UserMongo({
        username,
        email,
        password: hashedPassword,
        firstName,
        lastName
      });

      await newUser.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: newUser._id },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        success: true,
        data: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          token
        },
        message: 'User registered successfully'
      });
    } else {
      // Use mock database
      try {
        const newUser = await UserMock.create({
          username,
          email,
          password, // password will be hashed in the create function
          firstName,
          lastName
        });

        // Generate JWT token
        const token = jwt.sign(
          { userId: newUser._id },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.status(201).json({
          success: true,
          data: {
            id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            token
          },
          message: 'User registered successfully'
        });
      } catch (error) {
        if (error.message.includes('already exists')) {
          return res.status(400).json({ 
            success: false,
            data: null,
            message: error.message 
          });
        }
        throw error; // Re-throw other errors
      }
    }
  } catch (error) {
    console.error('Registration error:', error);
    next(error); // Pass to error handler
  }
});

// Login user
router.post('/login', validateLogin, checkValidation, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Get database connection from app
    const dbConnection = req.app.get('dbConnection');
    
    if (dbConnection && dbConnection.useMongoDB) {
      // Use MongoDB
      const user = await UserMongo.findOne({ email });
      if (!user) {
        return res.status(400).json({ 
          success: false,
          data: null,
          message: 'Invalid credentials' 
        });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ 
          success: false,
          data: null,
          message: 'Invalid credentials' 
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        data: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePicture: user.profilePicture,
          bio: user.bio,
          token
        },
        message: 'Login successful'
      });
    } else {
      // Use mock database
      const user = await UserMock.findByEmail(email);
      if (!user) {
        return res.status(400).json({ 
          success: false,
          data: null,
          message: 'Invalid credentials' 
        });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ 
          success: false,
          data: null,
          message: 'Invalid credentials' 
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        data: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePicture: user.profilePicture,
          bio: user.bio,
          token
        },
        message: 'Login successful'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    next(error); // Pass to error handler
  }
});

// Forgot password - Send reset link
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false,
        data: null,
        message: 'Email is required' 
      });
    }

    // Get database connection from app
    const dbConnection = req.app.get('dbConnection');
    
    let user;
    if (dbConnection && dbConnection.useMongoDB) {
      user = await UserMongo.findOne({ email });
    } else {
      user = await UserMock.findByEmail(email);
    }

    // Always return success to prevent user enumeration
    // In production, send actual email here
    if (user) {
      // Generate password reset token (expires in 1 hour)
      const resetToken = jwt.sign(
        { userId: user._id || user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      
      // In production: Send email with reset link
      // const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      // await sendEmail(user.email, 'Password Reset', resetLink);
      
      console.log('Password reset token for', email, ':', resetToken);
    }

    res.json({
      success: true,
      data: null,
      message: 'If an account exists with this email, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    next(error);
  }
});

// Reset password with token
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ 
        success: false,
        data: null,
        message: 'Token and new password are required' 
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ 
        success: false,
        data: null,
        message: 'Invalid or expired reset token' 
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Get database connection from app
    const dbConnection = req.app.get('dbConnection');
    
    if (dbConnection && dbConnection.useMongoDB) {
      await UserMongo.findByIdAndUpdate(decoded.userId, { 
        password: hashedPassword 
      });
    } else {
      await UserMock.updatePassword(decoded.userId, hashedPassword);
    }

    res.json({
      success: true,
      data: null,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    next(error);
  }
});

module.exports = router;
