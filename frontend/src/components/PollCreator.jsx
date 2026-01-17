/**
 * PollCreator Component
 * Issue #342: Polls System
 * Poll creation form for CreatePost modal
 */

import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import * as pollHelpers from '../utils/pollHelpers';

const PollCreator = ({ onPollCreate, onCancel }) => {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [duration, setDuration] = useState({ value: 1, unit: 'days' });
  const [allowVoteChange, setAllowVoteChange] = useState(true);
  const [errors, setErrors] = useState({});

  const durationOptions = pollHelpers.getPollDurationOptions();

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleDurationChange = (e) => {
    const selectedOption = durationOptions.find(opt => opt.label === e.target.value);
    if (selectedOption) {
      setDuration({
        value: selectedOption.value,
        unit: selectedOption.unit,
      });
    }
  };

  const handleSubmit = () => {
    // Validate
    const pollData = {
      question: question.trim(),
      options: options.filter(opt => opt.trim()),
    };

    const validation = pollHelpers.validatePollData(pollData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    // Create poll data
    const pollInfo = {
      question: question.trim(),
      options: options.map(opt => opt.trim()).filter(Boolean),
      duration: duration.value,
      durationUnit: duration.unit,
      allowVoteChange,
    };

    onPollCreate(pollInfo);
  };

  return (
    <div className="bg-bg-secondary rounded-lg border-2 border-brand-primary/30 p-4 my-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:poll" className="text-brand-primary text-2xl" />
          <h3 className="font-semibold text-text-primary">{t('poll.title')}</h3>
        </div>
        <button
          onClick={onCancel}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <Icon icon="mdi:close" className="text-xl" />
        </button>
      </div>

      {/* Question Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {t('poll.questionLabel')}
        </label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('poll.questionPlaceholder')}
          maxLength={200}
          className={`
            w-full px-3 py-2 border rounded-lg bg-bg-primary text-text-primary focus:ring-2 focus:ring-brand-primary focus:border-transparent
            ${errors.question ? 'border-status-error' : 'border-border'}
          `}
        />
        {errors.question && (
          <p className="text-status-error text-xs mt-1">{errors.question}</p>
        )}
        <div className="flex justify-between mt-1">
          <span className="text-xs text-text-muted">
            {question.length}/200
          </span>
        </div>
      </div>

      {/* Options */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {t('poll.optionsLabel')}
        </label>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-text-muted font-medium min-w-[1.5rem]">
                {index + 1}.
              </span>
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={t('poll.optionPlaceholder', { index: index + 1 })}
                className="flex-1 px-3 py-2 border border-border bg-bg-primary text-text-primary rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
              {options.length > 2 && (
                <button
                  onClick={() => handleRemoveOption(index)}
                  className="text-status-error hover:text-red-700 p-1"
                >
                  <Icon icon="mdi:delete" className="text-xl" />
                </button>
              )}
            </div>
          ))}
        </div>
        {errors.options && (
          <p className="text-status-error text-xs mt-1">{errors.options}</p>
        )}

        {/* Add Option Button */}
        {options.length < 6 && (
          <button
            onClick={handleAddOption}
            className="mt-2 text-brand-primary hover:underline text-sm font-medium flex items-center gap-1"
          >
            <Icon icon="mdi:plus-circle" className="text-lg" />
            {t('poll.addOption')}
          </button>
        )}
      </div>

      {/* Poll Settings */}
      <div className="mb-4 space-y-3">
        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t('poll.durationLabel')}
          </label>
          <select
            value={durationOptions.find(opt =>
              opt.value === duration.value && opt.unit === duration.unit
            )?.label || '1 Day'}
            onChange={handleDurationChange}
            className="w-full px-3 py-2 border border-border bg-bg-primary text-text-primary rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
          >
            {durationOptions.map((opt) => (
              <option key={opt.label} value={opt.label}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Allow Vote Change */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="allowVoteChange"
            checked={allowVoteChange}
            onChange={(e) => setAllowVoteChange(e.target.checked)}
            className="w-4 h-4 text-brand-primary rounded focus:ring-2 focus:ring-brand-primary"
          />
          <label htmlFor="allowVoteChange" className="text-sm text-text-secondary">
            {t('poll.allowVoteChange')}
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <button
          onClick={handleSubmit}
          className="flex-1 py-2 px-4 bg-brand-primary hover:bg-brand-primary-hover text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Icon icon="mdi:check" className="text-xl" />
          {t('poll.create')}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-border hover:bg-bg-tertiary text-text-secondary font-medium rounded-lg transition-colors"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
};

export default PollCreator;

