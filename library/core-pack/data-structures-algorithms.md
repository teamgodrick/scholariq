# Data Structures and Algorithms Essentials

Time complexity of common operations: array access is O(1), array search is O(n), and insertion in the middle is O(n). A linked list has O(1) insertion at the head and O(n) search. A stack (last in, first out) and a queue (first in, first out) support O(1) push, pop, enqueue and dequeue. A hash table gives average O(1) insert, delete and lookup, and O(n) in the worst case. A balanced binary search tree gives O(log n) search, insert and delete. A binary heap gives O(1) access to the min or max and O(log n) insert and delete.

Sorting: bubble, selection and insertion sort are O(n squared) in the worst case. Merge sort is O(n log n) always and stable, but uses O(n) extra space. Quick sort is O(n log n) on average and O(n squared) in the worst case. Heap sort is O(n log n) in place. Binary search needs a sorted array and runs in O(log n).

Graphs: Breadth-first search uses a queue and finds shortest paths in unweighted graphs. Depth-first search uses a stack or recursion and is used for cycle detection and topological sort. Dijkstra's algorithm finds shortest paths with non-negative weights, using a priority queue in O((V + E) log V). Bellman-Ford handles negative weights. Prim's and Kruskal's algorithms build a minimum spanning tree.

Recursion solves a problem by solving smaller versions of itself and needs a base case. Dynamic programming stores answers to overlapping subproblems, either top-down with memoization or bottom-up with tabulation; examples are Fibonacci, knapsack and longest common subsequence. Greedy algorithms make the locally best choice at each step, as in activity selection and Huffman coding. Big O notation describes the growth of running time as the input size grows.
