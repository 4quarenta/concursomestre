<?php
declare(strict_types=1);
require_once __DIR__ . '/../modules/study_schedule/services/StudyPlanEngine.php';
function checkPlan(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$raw = ['title'=>'Teste','startDate'=>'2026-10-22','examDate'=>'2027-04-01',
    'availability'=>['1'=>120,'2'=>120,'3'=>120,'4'=>120,'5'=>120,'6'=>0,'7'=>0],
    'sessionMinutes'=>40,'reservePercent'=>15,'subjects'=>[
        ['name'=>'A','topics'=>['A1','A2'],'questions'=>20,'weight'=>3],
        ['name'=>'B','topics'=>['B1','B2'],'questions'=>10,'weight'=>1]]];
$config=StudyPlanEngine::normalize($raw);
$sessions=StudyPlanEngine::generate($config);
$daily=[]; $minutes=['A'=>0,'B'=>0]; $ids=[];
foreach($sessions as $s) {
    checkPlan($s['date'] >= $config['startDate'] && $s['date'] < $config['examDate'], 'Session outside preparation period');
    $daily[$s['date']]=($daily[$s['date']]??-5)+$s['minutes']+5;
    $minutes[$s['subject']]+=$s['minutes']; $ids[]=$s['id'];
}
checkPlan(count(array_unique($ids))===count($ids),'Duplicate identifiers');
 $selected = StudyPlanEngine::normalize($raw + ['organizationId' => '12', 'positionId' => '34', 'boardId' => '56', 'areaId' => '78']);
checkPlan($selected['organizationId'] === '12' && $selected['positionId'] === '34' && $selected['boardId'] === '56' && $selected['areaId'] === '78', 'Selected taxonomy ids were not preserved');
try { StudyPlanEngine::normalize($raw + ['organizationId' => '0']); throw new RuntimeException('Invalid taxonomy id accepted'); } catch(InvalidArgumentException) {}
checkPlan(max($daily)<=102,'Daily availability/reserve exceeded');
checkPlan($minutes['A']>$minutes['B']*4,'Exam points not prioritized');
checkPlan(end($sessions)['date']>'2027-03-01','Schedule silently capped at twelve weeks');
foreach ($sessions as $session) {
    checkPlan(isset($session['startTime'], $session['endTime']), 'Generated session is missing its time window');
    checkPlan($session['startTime'] >= $config['availabilityWindows'][date('N', strtotime($session['date']))]['start'], 'Session starts before availability');
}
$windowRaw = $raw;
$windowRaw['startDate'] = '2026-10-26';
$windowRaw['examDate'] = '2026-11-04';
$windowRaw['availability'] = array_fill(1, 7, 0);
$windowRaw['availabilityWindows'] = array_fill(1, 7, ['start' => '19:00', 'end' => '19:00']);
$windowRaw['availabilityWindows']['1'] = ['start' => '19:00', 'end' => '00:00'];
$windowRaw['sessionMinutes'] = 60;
$windowConfig = StudyPlanEngine::normalize($windowRaw);
checkPlan($windowConfig['availability']['1'] === 300, 'Midnight must count as the end of the same day');
$windowSessions = StudyPlanEngine::generate($windowConfig);
checkPlan(count($windowSessions) >= 4, 'Expected several sessions in a five-hour window');
foreach ($windowSessions as $session) {
    checkPlan(date('N', strtotime($session['date'])) === '1', 'Study was scheduled outside the selected weekday');
    checkPlan($session['startTime'] >= '19:00', 'Session begins before the selected period');
    checkPlan($session['endTime'] === '00:00' || $session['endTime'] <= '23:59', 'Session extends beyond midnight');
}
$slot = StudyPlanEngine::findSlot($windowConfig, '2026-10-26', 40, $windowSessions);
checkPlan($slot === null, 'Rescheduling should fail when no free interval remains');
$oneSession = [$windowSessions[0]];
$slot = StudyPlanEngine::findSlot($windowConfig, '2026-10-26', 40, $oneSession);
checkPlan($slot !== null && $slot['startTime'] >= '19:00', 'A free interval should be found after an occupied session');
$invalidWindow = $windowRaw;
$invalidWindow['availabilityWindows']['1'] = ['start' => '19:00', 'end' => '18:59'];
try { StudyPlanEngine::normalize($invalidWindow); throw new RuntimeException('Invalid time window accepted'); } catch(InvalidArgumentException) {}
foreach(['2026-02-30','not-date','2026-13-01'] as $date) {
    try { StudyPlanEngine::date($date); throw new RuntimeException('Invalid date accepted'); } catch(InvalidArgumentException) {}
}
$raw['availability']=array_fill(1,7,0);
try { StudyPlanEngine::normalize($raw); throw new RuntimeException('Zero availability accepted'); } catch(InvalidArgumentException) {}
echo "Study plan calendar, capacity, weights, identifiers and validation passed.\n";
