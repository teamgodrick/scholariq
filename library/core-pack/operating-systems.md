# Operating Systems Fundamentals

A process is a program in execution with its own address space. A thread is a lightweight unit of execution inside a process; threads of one process share code, data and files but have their own stack and registers. Context switching saves the state of one process and loads another, and it is pure overhead.

CPU scheduling algorithms: First Come First Served (FCFS) is simple but can cause the convoy effect. Shortest Job First (SJF) gives the minimum average waiting time but needs burst-time knowledge and can starve long jobs. Round Robin gives each process a fixed time quantum and suits time-sharing systems. Priority scheduling can starve low-priority processes, which is solved by aging.

A deadlock needs four conditions at the same time: mutual exclusion, hold and wait, no preemption, and circular wait. Deadlocks are handled by prevention (break one condition), avoidance (the Banker's algorithm), detection and recovery, or by ignoring them.

Memory management: paging splits memory into fixed-size frames and pages and removes external fragmentation. Segmentation splits memory by logical units. Virtual memory lets a process use more memory than is physically available, using demand paging. A page fault occurs when a needed page is not in RAM. Page replacement algorithms include FIFO, LRU (least recently used) and Optimal; FIFO can show Belady's anomaly. Thrashing happens when the system spends more time swapping pages than executing.

Synchronization: a race condition occurs when the result depends on the order of execution. A mutex allows one thread into a critical section. A semaphore is a counter used for signalling and resource counting; a binary semaphore behaves like a lock. Classic problems are producer-consumer, readers-writers and dining philosophers.
