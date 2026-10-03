export const ztteam_decodeHtmlEntity = (str: string | null | undefined): string => {
  if (!str) return '';
  try {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
  } catch (e) {
    return str;
  }
};
