/**
 * Seed script – populate the DB with starter coding problems
 * Run: node seed.js
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Problem from './models/Problem.js'

dotenv.config()

const problems = [
  {
    title: 'Two Sum',
    slug: 'two-sum',
    difficulty: 'easy',
    tags: ['array', 'hash-map'],
    description: `Given an array of integers \`nums\` and an integer \`target\`, return the **indices** of the two numbers that add up to target.

You may assume that each input has exactly one solution, and you may not use the same element twice.`,
    constraints: '2 ≤ nums.length ≤ 10⁴\n-10⁹ ≤ nums[i] ≤ 10⁹\nExactly one valid answer exists.',
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] = 2 + 7 = 9' },
      { input: 'nums = [3,2,4], target = 6',     output: '[1,2]', explanation: 'nums[1] + nums[2] = 2 + 4 = 6' },
    ],
    testCases: [
      { input: '2 7 11 15\n9', expectedOutput: '0 1' },
      { input: '3 2 4\n6',     expectedOutput: '1 2' },
      { input: '3 3\n6',       expectedOutput: '0 1', isHidden: true },
    ],
    starterCode: {
      javascript: `function twoSum(nums, target) {
  // Your solution here
}

// Parse input
const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');
const nums = lines[0].split(' ').map(Number);
const target = parseInt(lines[1]);
const result = twoSum(nums, target);
console.log(result.join(' '));`,
      python: `def two_sum(nums, target):
    # Your solution here
    pass

import sys
lines = sys.stdin.read().strip().split('\\n')
nums = list(map(int, lines[0].split()))
target = int(lines[1])
result = two_sum(nums, target)
print(' '.join(map(str, result)))`,
      cpp: `#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    // Your solution here
    return {};
}

int main() {
    // Read input
    return 0;
}`,
    },
  },
  {
    title: 'Reverse a String',
    slug: 'reverse-string',
    difficulty: 'easy',
    tags: ['string', 'two-pointer'],
    description: `Write a function that reverses a string. The input is given as an array of characters \`s\`.

You must do this by modifying the input array **in-place** with O(1) extra memory.`,
    constraints: '1 ≤ s.length ≤ 10⁵\ns[i] is a printable ASCII character.',
    examples: [
      { input: 's = ["h","e","l","l","o"]',          output: '["o","l","l","e","h"]' },
      { input: 's = ["H","a","n","n","a","h"]', output: '["h","a","n","n","a","H"]' },
    ],
    testCases: [
      { input: 'hello',   expectedOutput: 'olleh' },
      { input: 'Hannah',  expectedOutput: 'hannaH' },
      { input: 'a',       expectedOutput: 'a', isHidden: true },
      { input: 'abcdef',  expectedOutput: 'fedcba', isHidden: true },
    ],
    starterCode: {
      javascript: `function reverseString(s) {
  // Your solution here
}

const s = require('fs').readFileSync('/dev/stdin','utf8').trim().split('');
reverseString(s);
console.log(s.join(''));`,
      python: `def reverse_string(s):
    # Your solution here
    pass

import sys
s = list(sys.stdin.read().strip())
reverse_string(s)
print(''.join(s))`,
      cpp: `#include <iostream>
#include <string>
#include <algorithm>
using namespace std;

void reverseString(string& s) {
    // Your solution here
}

int main() {
    string s;
    cin >> s;
    reverseString(s);
    cout << s << endl;
    return 0;
}`,
    },
  },
  {
    title: 'Valid Parentheses',
    slug: 'valid-parentheses',
    difficulty: 'medium',
    tags: ['stack', 'string'],
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
- Open brackets must be closed by the **same type** of brackets.
- Open brackets must be closed in the **correct order**.
- Every close bracket has a corresponding open bracket.`,
    constraints: '1 ≤ s.length ≤ 10⁴\ns consists of parentheses only.',
    examples: [
      { input: 's = "()"',     output: 'true' },
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"',     output: 'false' },
    ],
    testCases: [
      { input: '()',      expectedOutput: 'true' },
      { input: '()[]{}', expectedOutput: 'true' },
      { input: '(]',     expectedOutput: 'false' },
      { input: '([)]',   expectedOutput: 'false', isHidden: true },
      { input: '{[]}',   expectedOutput: 'true',  isHidden: true },
    ],
    starterCode: {
      javascript: `function isValid(s) {
  // Your solution here
}

const s = require('fs').readFileSync('/dev/stdin','utf8').trim();
console.log(isValid(s).toString());`,
      python: `def is_valid(s):
    # Your solution here
    pass

import sys
s = sys.stdin.read().strip()
print(str(is_valid(s)).lower())`,
      cpp: `#include <iostream>
#include <stack>
#include <string>
using namespace std;

bool isValid(string s) {
    // Your solution here
    return false;
}

int main() {
    string s;
    cin >> s;
    cout << (isValid(s) ? "true" : "false") << endl;
    return 0;
}`,
    },
  },
  {
    title: 'Maximum Subarray',
    slug: 'maximum-subarray',
    difficulty: 'medium',
    tags: ['dynamic-programming', 'divide-conquer'],
    description: `Given an integer array \`nums\`, find the **subarray** with the largest sum and return its sum.`,
    constraints: '1 ≤ nums.length ≤ 10⁵\n-10⁴ ≤ nums[i] ≤ 10⁴',
    examples: [
      { input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: '[4,-1,2,1] has the largest sum = 6' },
      { input: 'nums = [1]', output: '1' },
    ],
    testCases: [
      { input: '-2 1 -3 4 -1 2 1 -5 4', expectedOutput: '6' },
      { input: '1',                       expectedOutput: '1' },
      { input: '5 4 -1 7 8',             expectedOutput: '23', isHidden: true },
      { input: '-1',                      expectedOutput: '-1', isHidden: true },
    ],
    starterCode: {
      javascript: `function maxSubArray(nums) {
  // Your solution here (try Kadane's algorithm!)
}

const nums = require('fs').readFileSync('/dev/stdin','utf8').trim().split(' ').map(Number);
console.log(maxSubArray(nums));`,
      python: `def max_sub_array(nums):
    # Your solution here (try Kadane's algorithm!)
    pass

import sys
nums = list(map(int, sys.stdin.read().strip().split()))
print(max_sub_array(nums))`,
      cpp: `#include <iostream>
#include <vector>
#include <climits>
using namespace std;

int maxSubArray(vector<int>& nums) {
    // Your solution here
    return INT_MIN;
}

int main() {
    vector<int> nums;
    int x;
    while(cin >> x) nums.push_back(x);
    cout << maxSubArray(nums) << endl;
    return 0;
}`,
    },
  },
]

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'nexthire' })
    console.log('Connected to MongoDB')

    for (const p of problems) {
      await Problem.findOneAndUpdate(
        { slug: p.slug },
        p,
        { upsert: true, new: true }
      )
      console.log(`✅ Upserted: ${p.title}`)
    }

    console.log('\n🎉 Seed complete! 4 problems added.')
    process.exit(0)
  } catch (err) {
    console.error('Seed failed:', err)
    process.exit(1)
  }
}

seed()
