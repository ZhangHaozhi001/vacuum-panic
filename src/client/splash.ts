import {requestExpandedMode} from '@devvit/web/client'
import {todayKey} from '../shared/daily.ts'

const startBtn = document.getElementById('start-btn') as HTMLButtonElement
startBtn.addEventListener('click', ev => requestExpandedMode(ev, 'game'))

const dateLine = document.getElementById('puzzle-date')
if (dateLine) dateLine.textContent = `Today's puzzle: ${todayKey()}`
