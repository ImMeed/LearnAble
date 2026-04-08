// frontend/src/features/attention/components/RolePickerScreen.tsx

import { useTranslation } from 'react-i18next';
import { UserRole } from '../types/attention';
import './RolePickerScreen.css';

interface RolePickerScreenProps {
  onSelectRole: (role: UserRole) => void;
}

export default function RolePickerScreen({ onSelectRole }: RolePickerScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="role-picker" role="dialog" aria-modal="true" aria-label={t('attention.rolePicker.title')}>
      <div className="role-picker__card">
        <h2 className="role-picker__title">{t('attention.rolePicker.title')}</h2>
        <div className="role-picker__buttons">
          <button
            className="role-picker__btn role-picker__btn--teacher"
            onClick={() => onSelectRole('teacher')}
          >
            <span className="role-picker__icon" aria-hidden="true">🧑‍🏫</span>
            <span>{t('attention.rolePicker.teacher')}</span>
          </button>
          <button
            className="role-picker__btn role-picker__btn--student"
            onClick={() => onSelectRole('student')}
          >
            <span className="role-picker__icon" aria-hidden="true">🧒</span>
            <span>{t('attention.rolePicker.student')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
