import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { successResponse, errorResponse } from '../helper/response';
import { User } from '../models';
import generateToken from '../helper/generateToken';
import sendMail from '../helper/email';
import messageTemplate from '../helper/messageTemplate';


config();

class userService {
  static async addUser({
    email, firstName, lastName, password, address,
  }) {
    try {
      email = email.toLowerCase();
      const user = await User.findByPk(email);

      if (user) {
        return errorResponse(409, 'Email has already been taken.');
      }
      const salt = await bcrypt.genSalt(+process.env.SALT);
      password = await bcrypt.hash(password, salt);
      await User.create({
        email,
        firstName,
        lastName,
        password,
        address,
        signMethod: 'local',
        status: 'unverified',
        isAdmin: false,
      });
      return successResponse(201, { user: { email, firstName, lastName } });
    } catch (err) {
      return errorResponse(500, err);
    }
  }

  static async loginUser({ email, password }) {
    try {
      // check if user exits
      const user = await User.findByPk(email.toLowerCase());
      if (!user) return errorResponse(401, 'The email and password you entered did not match our records. Please double-check and try again.');
      // check if user password is correct
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return errorResponse(401, 'The email and password you entered did not match our records. Please double-check and try again.');
      const { firstName, lastName } = user;
      return successResponse(200, { user: { email: user.email, firstName, lastName } });
    } catch (err) {
      return errorResponse(500, err);
    }
  }

  static socialSign(user) {
    const { email, firstName, lastName } = user;
    return successResponse(200, { user: { email, firstName, lastName } });
  }

  static async verifyUser({ userEmail }) {
    try {
      userEmail = userEmail.toLowerCase();
      const user = await User.findByPk(userEmail);
      if (!user) return errorResponse(404, 'The email you entered did not match our records. Please double-check and try again.');

      const updatedUser = await user.update({
        status: 'verified',
      });
      const {
        email, firstName, lastName, address, status,
      } = updatedUser;
      return successResponse(200, {
        user: {
          email, firstName, lastName, address, status,
        },
      });
    } catch (error) {
      return errorResponse(500, error);
    }
  }

  static async resetPassword(email, { previousPassword, newPassword }) {
    try {
      // check if user exits
      const user = await User.findByPk(email.toLowerCase());
      // check if user previousPassword is correct
      const isMatch = await bcrypt.compare(previousPassword, user.password);
      if (!isMatch) return errorResponse(401, 'The previous password you entered did not match our records. Please double-check and try again.');

      const salt = await bcrypt.genSalt(+process.env.SALT);
      newPassword = await bcrypt.hash(newPassword, salt);

      await user.update({
        password: newPassword,
      });

      return successResponse(200, 'Successfully Reset Password.');
    } catch (error) {
      return errorResponse(500, error);
    }
  }

  static async sendPasswordResetEmail(email) {
    try {
      const token = generateToken({ email }, 3600);
      // check if user exits
      const user = await User.findByPk(email.toLowerCase());
      if (!user) return errorResponse(404, 'The email you entered did not match our records. Please double-check and try again.');
      const passwordResetUrl = `localhost:3000/password/reset/${token}`;
      await sendMail(email, 'Reset your Password', messageTemplate.resetPassword(passwordResetUrl));
      return successResponse(200, 'We have e-mailed your password reset link');
    } catch (error) {
      return errorResponse(500, error);
    }
  }

  static async receiveNewPassword({ token }, newPassword) {
    try {
      const payload = jwt.verify(token, process.env.secretOrPrivateKey);
      const user = await User.findByPk(payload.sub.toLowerCase()); // payload.sub is user email
      if (!user) return errorResponse(404, 'The email you entered did not match our records. Please double-check and try again.');
      const salt = await bcrypt.genSalt(+process.env.SALT);
      newPassword = await bcrypt.hash(newPassword, salt);
      await user.update({ password: newPassword });
      return successResponse(200, 'Your password has been reset successfully');
    } catch (error) {
      if (error.name === 'JsonWebTokenError') return errorResponse(400, 'Invalid reset token');
      if (error.name === 'TokenExpiredError') return errorResponse(400, 'Expired reset link');
      return errorResponse(500, error);
    }
  }
}

export default userService;
