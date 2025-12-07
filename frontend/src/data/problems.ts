import type { Problem } from '../types';

/**
 * Sample problems for the assessment platform.
 * Add your own problems here and import in InteractiveAssessmentPage.tsx
 */

export const BINARY_TREE_INVERT: Problem = {
  id: 'binary-tree-invert',
  title: 'Invert Binary Tree',
  description: `Given the root of a binary tree, invert the tree, and return its root.

Inverting a binary tree means swapping the left and right children of all nodes in the tree.

**Constraints:**
- The number of nodes in the tree is in the range [0, 100].
- -100 <= Node.val <= 100

**Follow-up:**
Can you solve this both recursively and iteratively?`,
  starterCode: {
    python: `# Definition for a binary tree node.
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def invertTree(root: TreeNode) -> TreeNode:
    # Your code here
    pass`,
  },
  testCases: [
    {
      input: 'root = [4,2,7,1,3,6,9]',
      output: '[4,7,2,9,6,3,1]',
    },
    {
      input: 'root = [2,1,3]',
      output: '[2,3,1]',
    },
  ],
};

export const TWO_SUM: Problem = {
  id: 'two-sum',
  title: 'Two Sum',
  description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

**Constraints:**
- 2 <= nums.length <= 10^4
- -10^9 <= nums[i] <= 10^9
- -10^9 <= target <= 10^9
- Only one valid answer exists.

**Follow-up:**
Can you come up with an algorithm that is less than O(n^2) time complexity?`,
  starterCode: {
    python: `from typing import List

def twoSum(nums: List[int], target: int) -> List[int]:
    # Your code here
    pass`,
  },
  testCases: [
    {
      input: 'nums = [2,7,11,15], target = 9',
      output: '[0,1]',
    },
    {
      input: 'nums = [3,2,4], target = 6',
      output: '[1,2]',
    },
  ],
};

export const MERGE_INTERVALS: Problem = {
  id: 'merge-intervals',
  title: 'Merge Intervals',
  description: `Given an array of intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.

**Constraints:**
- 1 <= intervals.length <= 10^4
- intervals[i].length == 2
- 0 <= start_i <= end_i <= 10^4

**Example:**
Input: intervals = [[1,3],[2,6],[8,10],[15,18]]
Output: [[1,6],[8,10],[15,18]]
Explanation: Since intervals [1,3] and [2,6] overlap, merge them into [1,6].`,
  starterCode: {
    python: `from typing import List

def merge(intervals: List[List[int]]) -> List[List[int]]:
    # Your code here
    pass`,
  },
  testCases: [
    {
      input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]',
      output: '[[1,6],[8,10],[15,18]]',
    },
    {
      input: 'intervals = [[1,4],[4,5]]',
      output: '[[1,5]]',
    },
  ],
};

export const LRU_CACHE: Problem = {
  id: 'lru-cache',
  title: 'LRU Cache',
  description: `Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.

Implement the LRUCache class:

- LRUCache(int capacity) Initialize the LRU cache with positive size capacity.
- int get(int key) Return the value of the key if the key exists, otherwise return -1.
- void put(int key, int value) Update the value of the key if the key exists. Otherwise, add the key-value pair to the cache. If the number of keys exceeds the capacity from this operation, evict the least recently used key.

The functions get and put must each run in O(1) average time complexity.

**Constraints:**
- 1 <= capacity <= 3000
- 0 <= key <= 10^4
- 0 <= value <= 10^5
- At most 2 * 10^5 calls will be made to get and put.`,
  starterCode: {
    python: `class LRUCache:
    def __init__(self, capacity: int):
        # Your code here
        pass

    def get(self, key: int) -> int:
        # Your code here
        pass

    def put(self, key: int, value: int) -> None:
        # Your code here
        pass`,
  },
  testCases: [
    {
      input: 'LRUCache lru = new LRUCache(2); lru.put(1, 1); lru.put(2, 2); lru.get(1);',
      output: '1',
    },
    {
      input: 'lru.put(3, 3); lru.get(2);',
      output: '-1 (evicted)',
    },
  ],
};

export const VALID_PARENTHESES: Problem = {
  id: 'valid-parentheses',
  title: 'Valid Parentheses',
  description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

**Constraints:**
- 1 <= s.length <= 10^4
- s consists of parentheses only '()[]{}'.`,
  starterCode: {
    python: `def isValid(s: str) -> bool:
    # Your code here
    pass`,
  },
  testCases: [
    {
      input: 's = "()"',
      output: 'true',
    },
    {
      input: 's = "()[]{}"',
      output: 'true',
    },
    {
      input: 's = "(]"',
      output: 'false',
    },
  ],
};

// Export all problems as an array for easy selection
export const ALL_PROBLEMS: Problem[] = [
  BINARY_TREE_INVERT,
  TWO_SUM,
  VALID_PARENTHESES,
  MERGE_INTERVALS,
  LRU_CACHE,
];

// Helper to get problem by ID
export function getProblemById(id: string): Problem | undefined {
  return ALL_PROBLEMS.find(p => p.id === id);
}

// Helper to get random problem
export function getRandomProblem(): Problem {
  return ALL_PROBLEMS[Math.floor(Math.random() * ALL_PROBLEMS.length)];
}

