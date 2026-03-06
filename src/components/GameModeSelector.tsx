import {
  Box,
  Typography,
  ToggleButton,
} from '@mui/material';
import type { GameMode } from '../types';
import { GAME_MODES } from '../types';

interface GameModeSelectorProps {
  currentMode: GameMode;
  onModeChange: (mode: GameMode) => void;
}

export default function GameModeSelector({
  currentMode,
  onModeChange,
}: GameModeSelectorProps) {
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {GAME_MODES.map((mode) => {
        const isSelected = currentMode === mode.id;

        return (
          <ToggleButton
            key={mode.id}
            value={mode.id}
            selected={isSelected}
            onChange={() => onModeChange(mode.id)}
            sx={{
              flex: 1,
              py: 1,
              px: 2,
              borderRadius: 2,
              border: isSelected ? '2px solid' : '1px solid',
              borderColor: isSelected ? mode.color : '#d4d4d4',
              backgroundColor: isSelected ? `${mode.color}10` : '#ffffff',
              color: isSelected ? mode.color : '#525252',
              textTransform: 'none',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: isSelected ? `${mode.color}15` : '#f5f5f5',
                borderColor: mode.color,
              },
              '&.Mui-selected': {
                backgroundColor: `${mode.color}10`,
                borderColor: mode.color,
              },
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                sx={{
                  fontSize: '0.9rem',
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? mode.color : '#171717',
                  lineHeight: 1.2,
                }}
              >
                {mode.nameZh}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  color: isSelected ? mode.color : '#737373',
                  opacity: isSelected ? 0.8 : 0.6,
                  lineHeight: 1.2,
                  mt: 0.3,
                }}
              >
                {mode.name}
              </Typography>
            </Box>
          </ToggleButton>
        );
      })}
    </Box>
  );
}
