import { useState } from 'react';
import { Box, Chip, TextField, IconButton } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
}

export function TagInput({ value, onChange, label = 'Tags' }: Props) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(value.filter(t => t !== tag));
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" style={{ gap: 8 }}>
        <TextField
          label={label}
          value={input}
          size="small"
          variant="outlined"
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="Type and press Enter"
          style={{ flex: 1 }}
        />
        <IconButton size="small" onClick={addTag} disabled={!input.trim()}>
          <AddIcon />
        </IconButton>
      </Box>
      {value.length > 0 && (
        <Box display="flex" flexWrap="wrap" style={{ gap: 4, marginTop: 8 }}>
          {value.map(tag => (
            <Chip
              key={tag}
              size="small"
              label={tag}
              onDelete={() => removeTag(tag)}
              variant="outlined"
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
