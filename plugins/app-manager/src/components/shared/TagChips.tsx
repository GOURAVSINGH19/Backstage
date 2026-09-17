import { Box, Chip } from '@material-ui/core';

export function TagChips({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <Box display="flex" flexWrap="wrap" style={{ gap: 4 }}>
      {tags.map(tag => (
        <Chip key={tag} size="small" label={tag} variant="outlined" />
      ))}
    </Box>
  );
}
