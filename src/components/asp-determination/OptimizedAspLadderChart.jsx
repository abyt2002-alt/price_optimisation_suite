import AspLadderChartBase from './AspLadderChartBase'

const OptimizedAspLadderChart = ({ rows }) => {
  return (
    <AspLadderChartBase
      title="Optimized ASP Ladder"
      rows={rows}
      aspKey="optimizedAsp"
      volumeKey="optimizedVolume"
      lineColor="#41C185"
      barColor="#41C185"
    />
  )
}

export default OptimizedAspLadderChart
