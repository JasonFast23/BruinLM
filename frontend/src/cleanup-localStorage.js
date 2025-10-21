// Cleanup script to remove old cancelled message IDs from localStorage
// Run this in browser console to reset the cancelled state

localStorage.removeItem('cancelledSvgMessages');
console.log('Cancelled message IDs cleared from localStorage');