'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getExpenses, createExpense, updateExpense, deleteExpense, getExpenseStats } from '@/lib/actions/expenses';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, Plus, X, Pencil, Trash2, TrendingUp, Wallet, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Expense } from '@/lib/supabase-types';

const CATEGORIES = ['Supplies', 'Rent', 'Utilities', 'Transport', 'Marketing', 'Salary', 'Other'];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState({ total: 0, byCategory: {}, last7DaysTotal: 0, count: 0 });
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Supplies');

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    loadExpenses();
    loadStats();
  }, [search, page]);

  const loadExpenses = async () => {
    const offset = (page - 1) * PAGE_SIZE;
    const { data, count } = await getExpenses(search, { limit: PAGE_SIZE, offset });
    setExpenses(data || []);
    setTotalCount(count || 0);
  };

  const loadStats = async () => {
    const statsData = await getExpenseStats();
    setStats(statsData);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const showingFrom = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, totalCount);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategory('Supplies');
    setEditingExpense(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (expense: any) => {
    setEditingExpense(expense);
    setDescription(expense.description);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!description || !amount || !category) {
      toast.error('Please fill all fields');
      return;
    }

    setIsSubmitting(true);

    const expenseData = {
      description,
      amount: parseFloat(amount),
      category,
    };

    const { error } = editingExpense
      ? await updateExpense(editingExpense.id, expenseData)
      : await createExpense(expenseData);

    setIsSubmitting(false);

    if (error) {
      toast.error(editingExpense ? 'Failed to update' : 'Failed to create');
    } else {
      toast.success(editingExpense ? 'Expense updated' : 'Expense added');
      setShowModal(false);
      resetForm();
      loadExpenses();
      loadStats();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;

    const { error } = await deleteExpense(id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Expense deleted');
      loadExpenses();
      loadStats();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-tactical text-tactical">EXPENSES</h1>
          <p className="text-white/60 text-sm uppercase tracking-wider">
            Track Business Costs
          </p>
        </div>
        <button onClick={openCreate} className="btn-tactical px-4">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-tactical">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-tactical-red" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">Total</span>
          </div>
          <p className="text-lg font-black text-tactical-red">{formatCurrency(stats.total)}</p>
        </div>
        <div className="card-tactical">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-tactical-orange" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">Last 7 Days</span>
          </div>
          <p className="text-lg font-black text-tactical-orange">{formatCurrency(stats.last7DaysTotal)}</p>
        </div>
        <div className="card-tactical">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-tactical-blue" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">Count</span>
          </div>
          <p className="text-lg font-black text-tactical-blue">{stats.count}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <input
          type="text"
          placeholder="Search expenses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-14 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
        />
      </div>

      {/* Category Breakdown */}
      {Object.keys(stats.byCategory).length > 0 && (
        <div className="card-tactical">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-3">By Category</h3>
          <div className="space-y-2">
            {Object.entries(stats.byCategory).map(([cat, amt]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-sm text-white/60">{cat}</span>
                <span className="font-semibold text-tactical-red">{formatCurrency(amt as number)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expenses List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">All Expenses</h2>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-white/50">
                {showingFrom}-{showingTo}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        {expenses.length === 0 ? (
          <div className="card-tactical py-8 text-center text-white/40">No expenses recorded</div>
        ) : (
          <div className="card-tactical divide-y divide-white/5">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-tactical-red/20 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-tactical-red" />
                  </div>
                  <div>
                    <p className="font-bold">{expense.description}</p>
                    <p className="text-sm text-white/40">{expense.category}</p>
                    <p className="text-xs text-white/30">{formatDate(expense.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-black text-tactical-red">{formatCurrency(expense.amount)}</p>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(expense)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(expense.id)} className="p-2 rounded-lg bg-tactical-red/10 hover:bg-tactical-red/20 text-tactical-red">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-tactical-slate rounded-t-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase">{editingExpense ? 'Edit Expense' : 'New Expense'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-6 h-6" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 block">Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this expense for?"
                  className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40" />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 block">Amount</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                  className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40" />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 block">Category</label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button key={cat} onClick={() => setCategory(cat)}
                      className={cn('py-2 rounded-lg text-xs font-bold uppercase transition-all',
                        category === cat ? 'bg-tactical-blue text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                      )}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={isSubmitting} className="w-full btn-tactical">
              {isSubmitting ? 'Saving...' : editingExpense ? 'Update' : 'Add Expense'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
