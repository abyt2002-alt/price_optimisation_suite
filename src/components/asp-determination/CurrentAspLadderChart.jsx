import AspLadderChartBase from './AspLadderChartBase'

const CurrentAspLadderChart = ({ rows }) => {
  return (
    <AspLadderChartBase
      title="Current ASP Ladder"
      rows={rows}
      aspKey="currentAsp"
      volumeKey="currentVolume"
      lineColor="#458EE2"
      barColor="#458EE2"
    />
  )
}

export default CurrentAspLadderChart
