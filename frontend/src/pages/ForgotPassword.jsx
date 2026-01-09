import React, { useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { authAPI } from "../services/authService";
import toast from "react-hot-toast";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await authAPI.forgotPassword(email);
      
      if (response.success) {
        toast.success(response.message);
        setIsSubmitted(true);
      } else {
        toast.error(response.message || "Failed to send reset link");
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      toast.error(error.response?.data?.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900">College Media</span>
        </Link>

        {/* Reset Password Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8 md:p-10">
          {!isSubmitted ? (
            <>
              <div className="mb-6">
                <Link 
                  to="/login" 
                  className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">Back to login</span>
                </Link>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Forgot password?</h1>
                <p className="text-gray-600">
                  No worries! Enter your email and we'll send you reset instructions.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#e8684a] focus:border-transparent outline-none transition text-gray-900"
                      placeholder="you@college.edu"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#e8684a] text-white py-3 rounded-xl font-semibold hover:bg-[#d65a3d] transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Success State */}
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Check your email</h1>
                <p className="text-gray-600 mb-6">
                  We've sent password reset instructions to <span className="font-semibold text-gray-900">{email}</span>
                </p>
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <p className="text-sm text-gray-600">
                    Didn't receive the email? Check your spam folder or{" "}
                    <button
                      onClick={() => setIsSubmitted(false)}
                      className="text-[#e8684a] hover:text-[#d65a3d] font-medium"
                    >
                      try another email
                    </button>
                  </p>
                </div>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to login</span>
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Footer Link */}
        <Link to="/" className="block text-center mt-6 text-gray-600 hover:text-gray-900 transition">
          ← Back to home
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
