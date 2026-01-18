/*****************************************************************************************
 * Circuit Breaker Implementation for Downstream Services
 * ---------------------------------------------------------------------------------------
 * Author: Ayaan Shaikh
 * Issue: Missing Circuit Breaker for Downstream Services (#943)
 * Description:
 *   This file implements a FULLY CUSTOM Circuit Breaker mechanism
 *   for backend service-to-service communication.
 *
 * States:
 *   - CLOSED
 *   - OPEN
 *   - HALF_OPEN
 *
 * Features:
 *   - Failure threshold
 *   - Timeout handling
 *   - Cool-down period
 *   - Metrics tracking
 *   - Fallback support
 *   - Express middleware compatibility
 *
 *****************************************************************************************/

"use strict";

/*****************************************************************************************
 * SECTION 1: Imports
 *****************************************************************************************/

const axios = require("axios");
const EventEmitter = require("events");

/*****************************************************************************************
 * SECTION 2: Constants & Enums
 *****************************************************************************************/

const CIRCUIT_STATE = {
  CLOSED: "CLOSED",
  OPEN: "OPEN",
  HALF_OPEN: "HALF_OPEN",
};

const DEFAULT_CONFIG = {
  failureThreshold: 5,        // Failures before opening circuit
  successThreshold: 2,        // Successes before closing circuit
  timeout: 5000,              // Request timeout (ms)
  cooldownPeriod: 10000,      // Time circuit stays OPEN (ms)
  monitoringPeriod: 60000,    // Metrics reset window
};

/*****************************************************************************************
 * SECTION 3: CircuitBreaker Class
 *****************************************************************************************/

class CircuitBreaker extends EventEmitter {
  constructor(serviceName, config = {}) {
    super();

    this.serviceName = serviceName;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.state = CIRCUIT_STATE.CLOSED;

    this.failureCount = 0;
    this.successCount = 0;

    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    this.metrics = {
      totalRequests: 0,
      failedRequests: 0,
      successfulRequests: 0,
      shortCircuitedRequests: 0,
    };

    this._startMetricsResetTimer();
  }

  /*****************************************************************************************
   * SECTION 4: Metrics Reset Logic
   *****************************************************************************************/

  _startMetricsResetTimer() {
    setInterval(() => {
      this.metrics = {
        totalRequests: 0,
        failedRequests: 0,
        successfulRequests: 0,
        shortCircuitedRequests: 0,
      };
    }, this.config.monitoringPeriod);
  }

  /*****************************************************************************************
   * SECTION 5: State Management
   *****************************************************************************************/

  _transitionToOpen() {
    this.state = CIRCUIT_STATE.OPEN;
    this.nextAttemptTime = Date.now() + this.config.cooldownPeriod;
    this.emit("open", this.serviceName);
  }

  _transitionToHalfOpen() {
    this.state = CIRCUIT_STATE.HALF_OPEN;
    this.successCount = 0;
    this.emit("half_open", this.serviceName);
  }

  _transitionToClosed() {
    this.state = CIRCUIT_STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.emit("closed", this.serviceName);
  }

  /*****************************************************************************************
   * SECTION 6: Request Permission Check
   *****************************************************************************************/

  _canRequestProceed() {
    if (this.state === CIRCUIT_STATE.CLOSED) {
      return true;
    }

    if (this.state === CIRCUIT_STATE.OPEN) {
      if (Date.now() > this.nextAttemptTime) {
        this._transitionToHalfOpen();
        return true;
      }
      return false;
    }

    if (this.state === CIRCUIT_STATE.HALF_OPEN) {
      return true;
    }

    return false;
  }

  /*****************************************************************************************
   * SECTION 7: Failure Handling
   *****************************************************************************************/

  _handleFailure(error) {
    this.failureCount++;
    this.metrics.failedRequests++;
    this.lastFailureTime = Date.now();

    if (
      this.state === CIRCUIT_STATE.HALF_OPEN ||
      this.failureCount >= this.config.failureThreshold
    ) {
      this._transitionToOpen();
    }

    this.emit("failure", {
      service: this.serviceName,
      error,
      state: this.state,
    });
  }

  /*****************************************************************************************
   * SECTION 8: Success Handling
   *****************************************************************************************/

  _handleSuccess() {
    this.metrics.successfulRequests++;

    if (this.state === CIRCUIT_STATE.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        this._transitionToClosed();
      }
    } else {
      this.failureCount = 0;
    }

    this.emit("success", this.serviceName);
  }

  /*****************************************************************************************
   * SECTION 9: Execute Protected Call
   *****************************************************************************************/

  async execute(action, fallback = null) {
    this.metrics.totalRequests++;

    if (!this._canRequestProceed()) {
      this.metrics.shortCircuitedRequests++;
      const error = new Error(
        `Circuit OPEN for service: ${this.serviceName}`
      );

      if (fallback) {
        return fallback(error);
      }

      throw error;
    }

    try {
      const response = await this._executeWithTimeout(action);
      this._handleSuccess();
      return response;
    } catch (err) {
      this._handleFailure(err);

      if (fallback) {
        return fallback(err);
      }

      throw err;
    }
  }

  /*****************************************************************************************
   * SECTION 10: Timeout Wrapper
   *****************************************************************************************/

  _executeWithTimeout(action) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Timeout after ${this.config.timeout}ms for ${this.serviceName}`
          )
        );
      }, this.config.timeout);

      Promise.resolve(action())
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /*****************************************************************************************
   * SECTION 11: Health & Debug Helpers
   *****************************************************************************************/

  getState() {
    return {
      service: this.serviceName,
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      metrics: this.metrics,
    };
  }
}

/*****************************************************************************************
 * SECTION 12: Circuit Registry
 *****************************************************************************************/

const circuitRegistry = new Map();

function getCircuit(serviceName, config) {
  if (!circuitRegistry.has(serviceName)) {
    circuitRegistry.set(
      serviceName,
      new CircuitBreaker(serviceName, config)
    );
  }
  return circuitRegistry.get(serviceName);
}

/*****************************************************************************************
 * SECTION 13: Public Service Call Wrapper
 *****************************************************************************************/

async function callService(
  serviceName,
  action,
  options = {}
) {
  const circuit = getCircuit(serviceName, options.config);

  return circuit.execute(
    action,
    options.fallback ||
      ((err) => {
        throw err;
      })
  );
}

/*****************************************************************************************
 * SECTION 14: Express Middleware (Optional)
 *****************************************************************************************/

function circuitBreakerMiddleware(serviceName, options = {}) {
  return async function (req, res, next) {
    try {
      const result = await callService(
        serviceName,
        () => next(),
        options
      );
      return result;
    } catch (err) {
      res.status(503).json({
        success: false,
        message: "Service temporarily unavailable",
        service: serviceName,
        error: err.message,
      });
    }
  };
}

/*****************************************************************************************
 * SECTION 15: Example Usage
 *****************************************************************************************/

/*
const express = require("express");
const app = express();

app.get("/users", async (req, res) => {
  const data = await callService("USER_SERVICE", () =>
    axios.get("http://user-service/api/users")
  );
  res.json(data.data);
});

app.listen(3000);
*/

/*****************************************************************************************
 * SECTION 16: Exports
 *****************************************************************************************/

module.exports = {
  callService,
  circuitBreakerMiddleware,
  getCircuit,
  CIRCUIT_STATE,
};
