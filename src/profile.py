from line_profiler import LineProfiler
import main
lp = LineProfiler()
lp.add_function(main.main)
lp.run('main.main()')
lp.print_stats()
