import { definePlugin } from 'millennium';
import { startLibraryButton } from './library';
import { Machine } from './Machine';
import { loadGames } from './store';

const SlotIcon = () => (
	<span style={{ marginRight: '5px', fontSize: '14px', lineHeight: 1 }} role="img" aria-label="slot machine">
		🎰
	</span>
);

export default definePlugin(() => {
	loadGames();
	startLibraryButton();
	return {
		title: 'Game Roulette',
		icon: <SlotIcon />,
		content: <Machine compact />,
	};
});
